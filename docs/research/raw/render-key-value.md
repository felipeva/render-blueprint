# RAW CAPTURE: Render Key Value

- **Source URL:** https://render.com/docs/key-value (fetched as https://render.com/docs/key-value.md)
- **Fetch date:** 2026-09-12
- **Capture method:** `curl` of Render's docs `.md` endpoint (returns `text/markdown`), verbatim, unedited below this header.

---

# Render Key Value — Provision Redis®-compatible datastores for caching and job queues.

*Render Key Value* provides low-latency in-memory storage that's ideal for shared caches and job queues. Key Value instances are compatible with virtually all clients that interact with Redis®\*.

Paid Key Value instances support [disk-backed persistence](#data-persistence) and enable it by default.

## Underlying libraries

- Newly created Render Key Value instances run Valkey 8.

[Valkey](https://valkey.io/) is an open-source key-value store that began as a fork of Redis version 7.2.4. For most libraries and frameworks that connect to a Redis instance, Valkey is a drop-in replacement.

  Learn more in the [FAQ](valkey-faq).

- Legacy Key Value instances (created before February 12, 2025) run Redis 6.
  - Legacy instances no longer receive version updates, but they will continue to operate as usual.

## Quickstarts

These Render quickstarts include steps for provisioning a Key Value instance:

- [Deploy a Celery background worker](/deploy-celery)
- [Deploy Rails with Sidekiq](/deploy-rails-sidekiq)
- [Rails caching with Redis](rails-caching-redis)
- [Connecting to Render Key Value with ioredis](connecting-to-redis-with-ioredis)

## Create your Key Value instance

**Tab: Dashboard**

1. Go to [dashboard.render.com/new/redis](https://dashboard.render.com/new/redis), or select *New > Key Value* in the Render Dashboard.

   This form appears:

   [image: New Key Value creation form]

2. Provide a helpful *Name* for your instance.
   - You can change this value at any time.
3. Choose a *Region* to run your instance in.
   - Choose the same region as your services that will connect to the instance. This minimizes latency and enables communication over your [private network](private-network).
4. Optionally change the instance's *Maxmemory Policy*.
   - [See details below](#maxmemory-policy).
5. Optionally set the instance's *Persistence Mode*.
   - [See details below](#data-persistence).
6. Scroll down and select a *compute plan*. This determines its available RAM and connection limit.

> [Learn about Free compute plan limitations](free#free-key-value).

   [image: Selecting a Valkey compute plan]

7. Click *Create Key Value*.

You're all set! Your new instance's status updates to *Available* in the Render Dashboard when it's ready to use.

**Tab: CLI**

#### 1. Install the CLI

Use any of the following methods to install the Render CLI or upgrade to the latest version:

**Tab: Homebrew**

##### Homebrew installation

Run the following commands:

```shell
brew update
brew install render
```

**Tab: WinGet**

##### WinGet installation

Run the following command:

```shell
winget install render.cli
```

**Tab: curl**

##### Installing with `curl`

Run the following command:

```shell
curl -fsSL https://raw.githubusercontent.com/render-oss/cli/refs/heads/main/bin/install.sh | sh
```

**Tab: Direct download**

##### Direct download

1. Open the CLI's [GitHub releases page](https://github.com/render-oss/cli/releases/).
2. Download the executable that corresponds to your system's architecture.

If you use an architecture besides those provided, you can build from source instead.

**Tab: Build from source**

##### Building from source

> We recommend building from source only if no other installation method works for your system.

1. [Install the Go programming language](https://golang.org/doc/install) if you haven't already.

2. Clone and build the CLI project with the following commands:

   ```shell
   git clone git@github.com:render-oss/cli.git
   cd cli
   go build -o render
   ```

After installation completes, open a new terminal tab and run `render` with no arguments to confirm.

#### 2. Create your instance

Run `render kv create` to walk through an interactive wizard:

```shell
render kv create
```

To skip the wizard, provide flags directly. For example:

```shell
render kv create \
  --name my-cache \
  --region oregon \
  --memory-policy cache \
  --plan free \
  --confirm
```

Supply the following options to configure your instance:

| Option | Description |
| --- | --- |
| `--name` | A name for your instance. You can change this value at any time. |
| `--region` | The region to create the instance in. Choose the same region as your connecting services to minimize latency and enable communication over your private network. |
| `--memory-policy` | Optionally set your instance's eviction policy. [See details below](#maxmemory-policy). |
| `--plan` | Specify a [compute plan](compute-plans?tab=key-value#all-plans) to determine the instance's available RAM and connection limit. 
> [Learn about Free compute plan limitations](free#free-key-value).
 |

For the full list of options, see the [`kv create` reference](cli-reference#kv-create).

You're all set! After successfully running the command, the Render CLI returns your new instance's details.

**Tab: API**

Using the [Render API](api), make a request to the [Create Key Value instance](https://api-docs.render.com/reference/create-key-value) endpoint.

## Connect to your Key Value instance

Every Key Value instance has two different URLs for incoming connections:

- An *internal URL* for connections from your other Render services running in the _same region_
  - Connections using the internal URL are unauthenticated by default. You can optionally [require authentication for internal connections](#requiring-auth-for-internal-connections).
- An *external URL* for connections from _everything else_
  - Before you can use the external URL, you must first [enable external connections](#enabling-external-connections) for your Key Value instance.

```mermaid
flowchart LR
    dev("Your dev machine<br/>(Valkey CLI, etc.)");
    subgraph "<b>Render</b>"
    webservice("Web<br/>service");
    kv[("Render<br/>Key Value")];
    webservice-->|"Internal<br/>URL"|kv;
    end
    dev--->|"External<br/>URL"|kv;
    class dev secondary;
```

*Use the internal URL wherever possible.* It minimizes latency by enabling communication over your [private network](private-network).

Key Value instances use `redis://` and `rediss://` URL schemes. You can connect to your instance using any Redis-compatible client that supports these schemes.

### Obtaining connection URLs

**Tab: Dashboard**

Both URLs are available from the *Connect* menu in the top-right corner of your instance's page in the [Render Dashboard](https://dashboard.render.com):

[image: Redis connection URLs]

**Tab: CLI**

You can fetch your instance's connection details and credentials using `render kv get` with the `--include-sensitive-connection-info` flag:

```shell
render kv get my-cache --include-sensitive-connection-info
```

For more options, see the [`kv get` reference](cli-reference#kv-get).

**Tab: API**

Use the [Retrieve Key Value connection info](https://api-docs.render.com/reference/retrieve-key-value-connection-info) API endpoint to retrieve your instance's connection details.

### Internal connection examples

> To connect with your internal URL, your Key Value instance and your connecting service must belong to the same workspace _and_ run in the same [region](regions).

**Tab: ioredis (JS)**

```js
import Redis from 'ioredis'

// Connect to your Key Value instance using the REDIS_URL environment variable
// The REDIS_URL is set to the internal connection URL e.g. redis://red-343245ndffg023:6379
const redis = new Redis(process.env.REDIS_URL)

// Set and retrieve some values
await redis.set('key', 'ioredis')
const result = await redis.get('key')
console.log(result)
```

**Tab: node-redis (JS)**

```js
import { createClient } from 'redis'

// Connect to your Key Value instance using the REDIS_URL environment variable
// The REDIS_URL is set to the internal connection URL e.g. redis://red-343245ndffg023:6379
const client = createClient({ url: process.env.REDIS_URL })
await client.connect()

// Set and retrieve some values
await client.set('key', 'node redis')
const value = await client.get('key')
console.log(value)
```

**Tab: redis-py (Python)**

```python
import os
import redis

# Connect to your Key Value instance using the REDIS_URL environment variable
# The REDIS_URL is set to the internal connection URL e.g. redis://red-343245ndffg023:6379
r = redis.from_url(os.environ['REDIS_URL'])

# Set and retrieve some values
r.set('key', 'redis-py')
print(r.get('key').decode())
```

**Tab: redis-rb (Ruby)**

```ruby
require "redis"

# Connect to your internal Key Value instance using the REDIS_URL environment variable
# The REDIS_URL is set to the internal connection URL e.g. redis://red-343245ndffg023:6379
redis = Redis.new(url: ENV["REDIS_URL"])

# Set and retrieve some values
redis.set("key", "redis ruby!")
puts redis.get("key")
```

**Tab: Sidekiq (Ruby)**

```ruby
require "sidekiq"

# Connect to your internal Key Value instance using the REDIS_URL environment variable
# The REDIS_URL is set to the internal connection URL e.g. redis://red-343245ndffg023:6379
Sidekiq.configure_server do |config|
  config.redis = { url: ENV["REDIS_URL"] }
end

Sidekiq.configure_client do |config|
  config.redis = { url: ENV["REDIS_URL"] }
end

# Simple example from https://github.com/mperham/sidekiq/wiki/Getting-Started
class HardJob
  include Sidekiq::Job

  def perform(name, count)
    # do something
  end
end

HardJob.perform_async("bob", 5)
```

### Enabling external connections

> *These rules apply only to connections that use your Key Value instance's external URL.*
>
> Your Render services in the same region as your Key Value instance can always connect using your instance's [internal URL](#connect-to-your-key-value-instance).

By default, newly created Key Value instances are _not_ reachable at their external URL. To keep your instance secure, you can grant external access to specific sets of IPs.

**Tab: Dashboard**

In the [Render Dashboard](https://dashboard.render.com), go to your Key Value instance's *Info* page and scroll down to the *Networking* section:

[image: Setting Key Value access control in the Render Dashboard]

Specify IP address blocks using [CIDR notation](https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing#CIDR_blocks). The example above grants access to two example blocks: one for an office network and another for a single development machine.

**Tab: CLI**

Set your instance's IP allow list using the `render kv update` command with the `--ip-allow-list` flag:

```shell
render kv update my-cache \
  --ip-allow-list "cidr=203.0.113.5/32,description=office" \
  --ip-allow-list "cidr=10.0.0.0/8,description=internal"
```

> *Passing `--ip-allow-list` to this command _replaces_ your Key Value instance's existing IP allow list.*
>
> Make sure to include _all_ address blocks you want to allow, including any existing blocks.

- Repeat the flag for each address block you want to allow.
- Provide IP address blocks in [CIDR notation](https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing#CIDR_blocks).

To completely disable external access to your instance, use the `--clear-ip-allow-list` flag:

```shell
render kv update my-cache --clear-ip-allow-list
```

For more options, see the [`kv update` reference](cli-reference#kv-update).

**Tab: API**

Use the [Update Key Value instance](https://api-docs.render.com/reference/update-key-value) API endpoint. Provide IP address blocks in [CIDR notation](https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing#CIDR_blocks) in the `ipAllowList` parameter.

If you attempt to connect from a disallowed IP address, your client will display an error like the following:

```
AUTH failed: Client IP address is not in the allowlist.
```

### Requiring auth for internal connections

By default, Key Value instances do not require authentication for internal connections over your [private network](private-network). This is why the default internal connection URL doesn't include a username or password:

```sh
# An unauthenticated internal URL (default)
redis://red-abc123:6379

# An authenticated internal URL
redis://USERNAME_HERE:PASSWORD_HERE@red-abc123:6379
```

> [External connections](#enabling-external-connections) always require authentication.

To enforce additional security or fulfill compliance requirements, your Key Value instance can require authentication for internal connections:

1. From your Key Value instance's *Info* page in the [Render Dashboard](https://dashboard.render.com), scroll down to the *Connections* section and click *Enable Internal Authentication*:

> *Any existing connections that use your unauthenticated URL will break!*
>
>    Before enabling this feature, we strongly recommend migrating your existing connections to use an authenticated URL. [See below](#migrating-unauthenticated-key-value-connections).

   [image: Enabling Key Value internal auth in the Render Dashboard]

2. A confirmation dialog appears. Review the advisories, then click *Enable Internal Authentication*.

After you confirm, Render restarts your Key Value instance (it will be unavailable for a few seconds).

After the restart:

- Your Key Value instance now requires authentication for all connections.
- In the Render Dashboard, your instance's internal connection URL now includes a username and password.

#### Migrating unauthenticated Key Value connections

Before you [require authentication](#requiring-auth-for-internal-connections) for internal Key Value connections, you can update all of your existing connections to use an authenticated URL. This will prevent those connections from breaking when you enable authentication.

1. Obtain your Key Value instance's _external_ connection URL from the *Connect* menu:

   [image: Obtaining your Key Value instance's external connection URL]

> *External URL isn't shown?*
>
>    You first need to add at least one IP range to your instance's [access control list](#enabling-external-connections). To continue blocking all external connections, you can add the dummy IP range `0.0.0.0/32`.

2. Extract the password from your external connection URL. The password starts immediately after the colon (`:`) and ends immediately before the "at" symbol (`@`):

   ```
   rediss://user:PASSWORD_HERE@red-abc123:6379
   ```

3. For each service that connects to your Key Value instance with the internal URL, modify its connection string as shown below:

   ```sh
   # Before
   redis://red-abc123:6379

   # After
   redis://default:PASSWORD_HERE@red-abc123:6379
   ```

   Specifically, you add the username `default` and the password you extracted in the previous step. Every Key Value instance has a user named `default`, and this user can accept _any_ password until auth is required.

4. Redeploy your modified services (unless they automatically redeployed when you updated their configuration).

5. You can now proceed through the steps to [require authentication](#requiring-auth-for-internal-connections) for internal connections.

After your Key Value instance restarts with authentication enabled, the `default` user now _requires_ the exact password you provided. Because you've updated your connections accordingly, they remain functional.

### Connecting with CLI tools

The [`redis-cli`](https://redis.io/topics/rediscli) is a useful administrative tool for exploring and manipulating data on your Redis instance. There are 2 ways you can use `redis-cli` with your Redis instance:

- If you have a running non-Docker service, `redis-cli` will be available as part of the environment and is accessible from the service's Shell page. The service must be in the same region as the Redis instance. You can also [SSH into that service](ssh) and run `redis-cli` from there.

- You can run `redis-cli` locally on your machine. You first need to [install](https://redis.io/docs/getting-started/installation/) `redis-cli` on your machine. You can copy a `redis-cli` command in the `External Access` section of your Redis settings. Note that you first need to [enable external connections](#enabling-external-connections) for your Redis instance.

> External connections are TLS secured. The Redis CLI command provided will include the `--tls` flag.

After you connect, you can set and get keys using various commands:

```
oregon-redis.render.com:6379> set "render_is_cool" true
OK
oregon-redis.render.com:6379> get "render_is_cool"
"true"
oregon-redis.render.com:6379> KEYS r*
1) "render_is_cool"
```

## Configure your Key Value instance

### Maxmemory policy

Your Key Value instance's *maxmemory policy* determines which data it evicts to free space when it reaches its memory limit. You select a policy on instance creation and can change it later.

- *For caching use cases,* we recommend using `allkeys-lru`.
- *For job queues,* we recommend using `noeviction` to ensure that queued jobs are not lost.
- *For other use cases,* select a policy from the table below based on your requirements.

You can select any of the following policies:

| Option | Description | Can memory fill up? |
| --- | --- | --- |
| `allkeys-lru` | Evict any key using approximated Least Recently Used (LRU). | No |
| `noeviction` | Don't evict data. Instead, return an error on write operations whenever the instance is out of memory. | Yes |
| `volatile-lru` | Evict using approximated LRU, only keys with an expire set. | Yes |
| `volatile-lfu` | Evict using approximated Least Frequently Used (LFU), only keys with an expire set. | Yes |
| `allkeys-lfu` | Evict any key using approximated LFU. | No |
| `volatile-random` | Remove a random key having an expire set. | Yes |
| `allkeys-random` | Remove a random key, any key. | No |
| `volatile-ttl` | Remove the key with the nearest expire time (minor TTL) | Yes |

### Data persistence

> *Data persistence is not available for free Key Value instances.*

Paid Key Value instances can write their state to disk to preserve data across restarts, upgrades, and other interruptions. This data is encrypted at rest using AES-256 encryption.

You set one of the following *persistence modes* on instance creation:

| Persistence mode | Description | AOF | RDB |
| --- | --- | --- | --- |
| *Journal + Snapshot* | Append all writes to a journal and periodically save a snapshot to disk. Journal writes occur once per second via the configuration `appendfsync everysec`. You might lose up to the last second of writes on restart or failure. Recommended for most non-caching use cases. | ☑️ | ☑️ |
| *Snapshot only* | Periodically save a snapshot to disk. Data since the most recent snapshot is lost on restart or failure. | ➖ | ☑️ |
| *Off* | Disable persistence completely to prioritize write performance. All data is lost on restart or failure. Recommended for caching use cases. | ➖ | ➖ |

- *For caching use cases,* we recommend turning persistence *Off*. This maximizes write performance when working with loss-tolerant data.
- *For all other use cases,* we recommend using *Journal + Snapshot* to maximize data retention.

Changing an existing Key Value instance's persistence mode triggers a restart, during which your instance is unavailable for a few seconds. Note that if you change your mode to _or_ from *Off*, your instance's data is lost after the restart.

### Changing compute plans

You can upgrade your Key Value instance to a larger compute plan with more RAM and a higher connection limit.

> *Note all of the following before you upgrade:*
>
> - It is not currently possible to downgrade a Key Value instance.
> - Your instance will be unavailable for a minute or two during the upgrade.
> - Upgrading requires a restart. This can result in data loss based on your instance's [persistence mode](#data-persistence).
>   - Free instances don't support data persistence, so their data is always lost on upgrade.

**Tab: Dashboard**

1. In the [Render Dashboard](https://dashboard.render.com), open your instance's *Info* page and scroll down to the *Key Value Instance* section.

2. Under *Compute Plan*, click *Update*.

3. Select a new compute plan and click *Save Changes*.

**Tab: CLI**

Upgrade your instance using the `render kv update` command with the `--plan` flag:

```shell
render kv update my-cache --plan standard
```

For more options, see the [`kv update` reference](cli-reference#kv-update).

**Tab: API**

Use the [Update Key Value instance](https://api-docs.render.com/reference/update-key-value) API endpoint. Provide the new plan in the `plan` parameter.

> *Need an instance with more than 10 GB of RAM?*
>
> Please reach out to our support team in the [Render Dashboard](https://dashboard.render.com?contact-support).

### Blueprint configuration

As with your other services, you can manage your Key Value instances with [Blueprints](infrastructure-as-code), Render's infrastructure-as-code model. For details and examples, see the [Blueprint YAML Reference](blueprint-spec#render-key-value).

## Metrics

Metrics for memory usage, CPU load, and active connections are available from your Key Value instance's Metrics page in the Render Dashboard:

[image: Key Value active connections metric]

For details, see [Service Metrics](service-metrics#available-metrics).

Redis is a registered trademark of Redis Ltd. Any rights therein are reserved to Redis Ltd. Any use by Render Inc is for referential purposes only and does not indicate any sponsorship, endorsement or affiliation between Redis and Render Inc.

---

##### Appendix: Glossary definitions

###### region

Each Render service runs in one of the following regions: *Oregon*, *Ohio*, *Virginia*, *Frankfurt*, or *Singapore*.

Services in the same region can communicate over their *private network*.

Related article: https://render.com/docs/regions.md

###### private network

Your Render services in the same *region* can reach each other without traversing the public internet, enabling faster and safer communication.

Related article: https://render.com/docs/private-network.md