# RAW CAPTURE: Render Postgres High Availability

- **Source URL:** https://render.com/docs/postgresql-high-availability (fetched as https://render.com/docs/postgresql-high-availability.md)
- **Fetch date:** 2026-09-12
- **Capture method:** `curl` of Render's docs `.md` endpoint (returns `text/markdown`), verbatim, unedited below this header.

---

# High Availability for Render Postgres — Automatically swap to a standby database when your primary encounters an issue.

You can enable *High Availability* (*HA*) for any Render Postgres database with the [required specs](#prerequisites).

When you enable HA, Render maintains a separate *standby* instance of your database that asynchronously replicates the state of your *primary* instance:

```mermaid
flowchart TB
  subgraph "<b>Render</b>"
    others@{ shape: procs, label: "Your other<br/>services" }
    primary[("Primary<br/>(Zone 1)")]
    standby[("Standby<br/>(Zone 2)")]
    others edge1@--> primary;
    others ~~~ standby;
    edge1@{animation: slow}
    class primary success;
    class standby secondary;
  end
```

The standby runs in the same [region](regions) as the primary, but in a different "zone" that's geographically separate from the primary (on the order of tens of kilometers). This separation helps to maximize availability in the event of a major disruption.

If a critical issue causes your primary instance to become unavailable for 30 seconds, Render detects this and [automatically fails over](#automatic-failover) to the standby to keep you up and running:

```mermaid
flowchart TB
  subgraph "<b>Render</b>"
    others@{ shape: procs, label: "Your other<br/>services" }
    primary[("<s>Primary</s><br/>❌")]
    standby[("Standby<br/>🟢")]
    others -.-|"❌"| primary;
    others edge1@--> standby;
    edge1@{animation: slow}
  end
  class primary failure;
  class standby success;
```

This process takes a few seconds, after which the standby instance becomes the new primary (now hosted at the same URL as the _original_ primary). When the degraded instance becomes healthy again, it becomes the new standby.

> Your standby instance always has the same compute plan and storage as your primary instance and is billed accordingly.

## Prerequisites

For your database to support high availability, it must:

- Use a [compute plan](compute-plans#render-postgres-plans) with at least 1 CPU
- Use PostgreSQL version 13 or later

> *If your database uses a [*legacy instance type*](postgresql-legacy-instance-types), it must:*
>
> - Use the *Pro* instance type or higher
> - Use PostgreSQL version 13 or later

## Setup

> *Enabling HA requires a database restart!*
>
> Your database will be unavailable temporarily (usually for less than five minutes). Schedule your activation of this feature accordingly.

1. In the [Render Dashboard](https://dashboard.render.com), select your database and open its *Info* page.
2. Scroll down to the *High Availability* section and toggle the switch:

   [image: Enabling HA Postgres]

3. A confirmation dialog appears. Review the details and then click *Enable HA*.

That's it! Your database will restart with HA enabled.

## Failover

*Failover* refers to the process of swapping out your primary database instance for your standby instance.

Render performs failover [automatically](#automatic-failover) when your primary instance becomes unavailable, and you can perform a [manual](#manual-failover) failover for testing purposes. In all cases, failover takes just a few seconds, after which your other services can [reconnect](#reconnecting-after-a-failover) to your database.

### Automatic failover

Render automatically triggers a failover to your database's standby instance whenever your primary instance becomes unavailable for 30 seconds.

Your primary instance might become unavailable because:

- The node running the instance becomes unresponsive or goes down.
- A network disruption prevents communication with the instance.
- The PostgreSQL process itself crashes.

> Automatic failover might fail to preserve a small number of the most recent writes to your degraded primary instance. For details, see [Limitations of HA](#limitations-of-ha).

### Manual failover

> *Manual failover is intended for testing and compliance purposes.* [Automatic failover](#automatic-failover) handles scenarios where your primary instance becomes unavailable.

You can manually trigger a failover to your database's standby instance from the [Render Dashboard](https://dashboard.render.com). You might want to do this to test out reconnection behavior for your apps, or to demonstrate failover capabilities for compliance purposes.

Go to your database's *Info* page and click *Trigger Failover* under the *High Availability* section:

[image: Triggering a manual failover]

Performing a manual failover with a healthy primary instance _almost never_ causes any loss of data. It's possible (but unlikely) that changes to your primary instance in the last few seconds before the failover will be lost.

### Reconnecting after a failover

Whenever a failover occurs ([automatic](#automatic-failover) or [manual](#manual-failover)), all active connections to your primary instance are terminated. Clients need to reconnect to the _new_ primary instance, which becomes reachable at the exact same database URL. To enable reconnection, make sure your clients include retry functionality in their connection logic.

## Limitations of HA

- HA increases your database's response latency by approximately 1 millisecond.
  - This is because Render operates a proxy in front of the database to identify connectivity issues and trigger failovers.
- Render runs your primary and standby instances on geographically separated nodes in the same region. In the unlikely event that _both_ nodes are affected by an incident, your database will experience downtime.
- When an [automatic failover](#automatic-failover) occurs, a small number of the most recent writes to your degraded primary instance might not be represented in your standby instance. These changes are lost.
  - This is because data is replicated asynchronously, and the primary might not have pushed the most recent writes to the standby before the degradation occurred.
  - In almost all cases, no more than a few seconds of changes are lost.
- A [manual failover](#manual-failover) _almost never_ results in lost changes, but it's possible that changes to your primary instance in the last few seconds before the failover will be lost.
- Failover isn't possible if your standby instance isn't available. This might occur for one of the following reasons:
  - The standby is affected by the same severe incident as the primary.
  - The standby is affected by an unrelated, simultaneous incident.
  - Render is performing routine maintenance on the standby.
  - An incident occurs shortly after a _previous_ failover occurred, and the degraded instance has not yet become healthy.
  - An incident occurs shortly after you initialize your primary database (before the standby is _also_ initialized).
- You can't connect to a HA database's standby instance or use it for query scaling purposes. For this use case, instead create a [read replica](postgresql-read-replicas).