# RAW CAPTURE: Render Persistent Disks

- **Source URL:** https://render.com/docs/disks (fetched as https://render.com/docs/disks.md)
- **Fetch date:** 2026-09-07
- **Capture method:** `curl` of Render's docs `.md` endpoint (returns `text/markdown`), verbatim, unedited below this header.

---

# Persistent Disks — Preserve your service's filesystem changes across deploys.

You can attach a *persistent disk* to a paid Render [web service](web-services), [private service](private-services), or [background worker](background-workers). This enables you to preserve local filesystem changes across deploys and restarts.

> *By default, Render services have an [*ephemeral filesystem*](/deploys#ephemeral-filesystem).*
>
> This means that without a persistent disk, any changes you make to a service's local files are _lost_ every time the service redeploys or restarts.

Persistent disks are useful for services such as:

- Infrastructure components ([Elasticsearch](/deploy-elasticsearch), [Kafka](https://kafka.apache.org), [RabbitMQ](/deploy-rabbitmq), etc.)
- A blogging platform or CMS ([WordPress](/deploy-wordpress), [Ghost](/deploy-ghost), [Strapi](https://strapi.io), etc.)
- Collaboration apps ([Mattermost](https://mattermost.com), [GitLab](https://gitlab.com), [Discourse](https://www.discourse.org), etc.)
- Custom datastores ([MySQL](/deploy-mysql), [MongoDB](https://www.mongodb.com), etc.)
  - Note that Render offers managed [Postgres](postgresql) (relational database) and [Key Value](key-value) instances. If one of these services suits your needs, we recommend using it instead of setting up your own with a persistent disk.

Persistent disks use the same high-performance SSDs as Render [Postgres](postgresql) and [Key Value](key-value) instances. All disks are encrypted at rest, and so are their [automatic daily snapshots](#disk-snapshots).

## Setup

> Before you attach a persistent disk, it's helpful to understand important [limitations and considerations](#disk-limitations-and-considerations).

You create persistent disks from the [Render Dashboard](https://dashboard.render.com). You can do so during service creation (click *Advanced* at the bottom of the creation form), or any time _after_ creation from your service's *Disks* page:

[image: Adding a persistent disk in the Render Dashboard]

1. Set your disk's *mount path*.
   - *Only filesystem changes under this path are preserved across deploys and restarts!* The rest of your service's filesystem remains ephemeral.
   - For more details, see [Mount path](#mount-path).
2. Choose a disk *size*.
   - You can increase your disk's size later, but you can't _decrease_ it. Pick the smallest value that currently works for your service.
3. Click *Add disk*.

After you save, Render triggers a new deploy for your service. The disk becomes available as soon as the deploy is live.

## Mount path

When you attach a persistent disk to a service, you specify its absolute *mount path*. Only data written under this path is preserved across deploys and restarts.

You can mount a disk at any path except those listed [below](#disallowed-mount-paths).

Specify a mount path according to how your service stores data:

- If your framework writes to a relative path (e.g., Rails Active Storage uses `./storage` for file uploads), mount your disk at the absolute version of that path or an ancestor of it. See the table below for mount paths by runtime.
- Otherwise, use a standalone directory like `/var/data` and configure your application to write persistent data there.

To mount your disk in a subdirectory of your service's source code, the absolute path depends on your runtime:

| Runtime | Source code path | Example disk mount path |
| --- | --- | --- |
| Node.js, Python, Ruby, Elixir, and Rust | `/opt/render/project/src` | `/opt/render/project/src/storage` |
| Go | `/opt/render/project/go/src/github.com/<owner>/<repo>` | `/opt/render/project/go/src/github.com/<owner>/<repo>/data` |
| Docker | Your Dockerfile's `WORKDIR` (commonly `/app`) | `/app/storage` |

### Disallowed mount paths

You _cannot_ mount a disk at any of these exact mount paths:
- `/` (filesystem root)
- `/opt`, `/opt/render`, `/opt/render/project`, `/opt/render/project/src`
- `/home`, `/home/render`
- `/etc`, `/etc/secrets`

You _can_ mount a disk at a subdirectory within one of these paths. For example, you can mount your disk at `/opt/render/project/src/uploads`.

## Monitoring usage

View your disk's usage over time from your service's *Disks* page in the [Render Dashboard](https://dashboard.render.com):

[image: Disk usage shown in the Render Dashboard]

## Disk snapshots

Render automatically creates a snapshot of your persistent disk once every 24 hours. If your disk experiences critical data loss or corruption, you can completely restore its state to any available snapshot. Snapshots are available for at least seven days after they're created.

> *Important:*
>
> - If you restore a snapshot, all changes to your disk that occurred _after_ the snapshot are lost.
> - Render doesn’t support restoring only a portion of a disk snapshot.
> - Do not restore a snapshot of a disk that's used for a custom database instance. [See details](#restoring-a-custom-database).

Restore a snapshot from your service's Disks page in the [Render Dashboard](https://dashboard.render.com):

[image: Restoring a disk snapshot in the Render Dashboard]

### Restoring a custom database

If you use a persistent disk specifically to back a custom database instance on Render (such as MySQL or MongoDB), *do not perform a disk restore for database recovery purposes.* If you do, your database might restore to a corrupted state.

Instead, create regular backups of your database using a tool like [mysqldump](https://dev.mysql.com/doc/refman/8.0/en/mysqldump.html) for MySQL or [mongodump](https://www.mongodb.com/docs/manual/core/backups/#back-up-with-mongodump) for MongoDB. Restore your database's state using one of these backups.

## Transferring files

You can securely transfer files between your disk-backed service and your local machine using a tool like [SCP](#scp) or [Magic-Wormhole](#magic-wormhole).

### SCP

After you [set up SSH](ssh) for your service, you can transfer files using [SCP](https://man.openbsd.org/scp).

For example, if your `ssh` command looks like this:

```shell
ssh YOUR_SERVICE@ssh.YOUR_REGION.render.com
```

Then your `scp` commands look like this:

```shell
# Copying a file from your service to your local machine
scp -s YOUR_SERVICE@ssh.YOUR_REGION.render.com:/path/to/remote/file /destination/path/for/local/file
file        100% 5930KB 999.9KB/s   00:05

# Copying a file from your local machine to your service
scp -s /path/to/local/file YOUR_SERVICE@ssh.YOUR_REGION.render.com:/destination/path/for/remote/file
file        100% 5930KB 999.9KB/s   00:05
```

> We recommend using SCP with the `-s` flag to use the more modern SFTP protocol. Future releases of SCP will default to using SFTP, and this flag will no longer be needed.

### Magic-Wormhole

The [Magic-Wormhole library](https://magic-wormhole.readthedocs.io/en/latest/) enables you to transfer files to and from your disk-backed service without using SSH and SCP.

1. In the [Render Dashboard](https://dashboard.render.com), go to your service's *Shell* page.

2. *If you have a Docker-image-backed service,* use the shell to install `magic-wormhole`:

   - Run `apt update && apt install magic-wormhole` or the equivalent for your environment.
   - The `magic-wormhole` library is pre-installed on all Render native runtimes.

3. Use the shell to transfer your file with the `wormhole` command:

   ```shell
   wormhole send /path/to/filename.txt
   Sending 10.5 MB file named 'filename.txt'
   Wormhole code is: 4-forever-regain
   ```

4. Note the code that appears in the output from `wormhole`. Then, from any internet-connected machine, install [magic-wormhole](https://magic-wormhole.readthedocs.io/en/latest/welcome.html) and run `wormhole receive`, entering in the code when prompted.

## Disk limitations and considerations

When attaching a persistent disk to your service, note the following:

- *Only filesystem changes under your disk's mount path are preserved across deploys and restarts.*

  - The rest of your service's filesystem remains [ephemeral](/deploys#ephemeral-filesystem).

- A persistent disk is accessible by only a single service instance, and only at runtime. This means:

  - You can't access a service's disk from any other service.

  - You can't [scale](scaling) a service to multiple instances if it has a disk attached.

  - You can't access persistent disks during a service's [build command](/deploys#build-command) or [pre-deploy command](/deploys#pre-deploy-command) (these commands run on separate compute).

  - You can't access a service's disk from a [one-off job](one-off-jobs) you run for the service (one-off jobs run on separate compute).

- Adding a disk to a service prevents [zero-downtime deploys](/deploys#zero-downtime-deploys). This is because:

  - When you redeploy your service, Render stops the existing instance _before_ bringing up the new instance.

  - This instance swap takes a few seconds, during which _your service is unavailable_.

  - This is a necessary safeguard to prevent data corruption that can occur when different versions of an app read and write to the same disk simultaneously.

- You can't add a disk to a [cron job](cronjobs) service.

  - As an alternative, you _can_ add a disk to a [background worker](background-workers), which is useful for processes that run continuously and don’t expose a port.

- You can increase your disk's size later, but you can't _decrease_ it. Pick the smallest value that currently works for your service.

  - Increasing a disk's size does not cause downtime. The additional storage becomes available to your service within a few seconds.