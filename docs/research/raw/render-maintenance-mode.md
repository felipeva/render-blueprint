# RAW CAPTURE: Render Maintenance Mode

- **Source URL:** https://render.com/docs/maintenance-mode (fetched as https://render.com/docs/maintenance-mode.md)
- **Fetch date:** 2026-09-12
- **Capture method:** `curl` of Render's docs `.md` endpoint (returns `text/markdown`), verbatim, unedited below this header.

---

# Maintenance Mode — Temporarily disable public traffic to your web service.

To help you make major infrastructure changes safely, you can enable *maintenance mode* for any paid web service:

[image: The default maintenance page for a service in maintenance mode]

A web service in maintenance mode remains up and running, but it's unreachable from the public internet. This helps you ensure that no user actions are in progress while you make changes.

> A web service in maintenance mode is still reachable over your [private network](private-network) and via [SSH](ssh).

## Steps to enable

> Maintenance mode is available only for paid web services.

**Tab: Dashboard**

1. From your web service's *Settings* page in the [Render Dashboard](https://dashboard.render.com), scroll down to the *Maintenance Mode* section:

   [image: Enabling maintenance mode in the Render Dashboard]

2. Toggle the switch and confirm your action in the dialog that appears.

That's it! After you confirm, Render immediately enables maintenance mode for the service. You can disable it at any time by toggling the switch back.

**Tab: Blueprint**

Add the `maintenanceMode` field to your service's configuration in your Blueprint YAML file:

```yaml
services:
  - type: web
    runtime: node
    name: my-service
    maintenanceMode:
      enabled: true # Set to false to disable maintenance mode
```

To use a custom maintenance page, you can optionally set `uri`:

```yaml
services:
  - type: web
    runtime: node
    name: my-service
    maintenanceMode:
      enabled: true
      uri: https://example.com/maintenance
```

If you omit `uri`, Render displays the default maintenance page.

## Response format

While your web service is in maintenance mode, Render responds to every incoming request with a `503 Service Unavailable` status code and your specified *maintenance page*:

- By default, Render displays [this maintenance page](https://maintenance-mode-example.onrender.com/).
- Set a custom maintenance page by specifying its URL in your service's maintenance mode settings.
  - *This must _not_ be a URL of the service in maintenance mode.* We recommend providing the URL of a page on a static site.
  - If your custom URL returns an error, Render responds with that error (not the default maintenance page).

---

##### Appendix: Glossary definitions

###### web service

Deploy this *service type* to host a dynamic application at a public URL.

Ideal for full-stack web apps and API servers.

Related article: https://render.com/docs/web-services.md

###### static site

Deploy this *service type* to host a static website (HTML/CSS/JS) over a global CDN at a public URL.

Related article: https://render.com/docs/static-sites.md