# RAW CAPTURE: Render Service Previews

- **Source URL:** https://render.com/docs/service-previews (fetched as https://render.com/docs/service-previews.md)
- **Fetch date:** 2026-09-12
- **Capture method:** `curl` of Render's docs `.md` endpoint (returns `text/markdown`), verbatim, unedited below this header.

---

# Service Previews — Test proposed changes in a temporary standalone instance.

Render *service previews* enable you to test out proposed changes to a web service or static site before you deploy those changes to production.

[image: Service preview in GitHub pull request]

For each service preview, Render creates a _separate, temporary instance_ of your service with its own `onrender.com` URL (served over HTTP/2 with full TLS), so you can validate your changes safely. Render automatically sets the HTTP response header `X-Robots-Tag: noindex` for all preview instances.

There are two types of service previews:

- [*Pull request previews*](#pull-request-previews-git-backed) (for Git-backed services)
- [*Image previews*](#image-previews) (for services that deploy a Docker image from a container registry)

See details for each below.

> *Service previews only replicate the service with proposed changes.*
>
> To create temporary instances of _multiple_ services (including datastores) for integration testing, see [Preview Environments](preview-environments).

## Pull request previews (Git-backed)

For Git-backed services, Render can create a service preview for pull requests opened against your linked branch. You can create a separate preview for every pull request, or only for pull requests that you specify.

### Steps to enable

1. In the [Render Dashboard](https://dashboard.render.com), select your service and open its *Previews* tab:

2. Under *Pull Request Previews*, select either *Manual* or *Automatic*:

   [image: Setting PR preview options in the Render Dashboard]

   For details on each option, see [Manual vs. automatic previews](#manual-vs-automatic-pr-previews).

That's it! After you enable service previews, active preview instances appear on your service's *Previews* tab:

[image: A service preview entry in the Render Dashboard]

Preview details also appear on their associated PR:

- *On GitHub,* preview instances are represented as deployments associated with your PR:

  [image: Service preview in GitHub pull request]

  Click *View deployment* to open the preview instance in your browser.

- *On GitLab, Bitbucket, and Cursor Origin,* Render adds a comment to your PR with a link to your preview instance.

### Manual vs. automatic PR previews

------

###### Manual

By default, Render does _not_ create PR previews. To create a preview for a specific PR, do any of the following:

- Add the label `render-preview` to the PR (GitHub/GitLab only).
- Include the string `[render preview]` in your PR's _title_ (not the commit message).

You can add or remove the above values from an existing PR at any time. If you do, Render creates or deprovisions the associated preview instance accordingly.

###### Automatic

By default, Render creates a preview instance for _every_ PR against your service's linked branch. You can [skip individual previews](#skipping-a-preview) for specific PRs.

------

### Skipping a preview

For services with automatic PR previews enabled, you can skip creating a preview for a specific PR. Do any of the following:

- Add the label `render-preview-skip` to the PR (GitHub/GitLab only).
- Include any of the following strings in your PR's _title_ (not the commit message):
  - `[skip preview]`
  - `[preview skip]`
  - `[skip render]`
  - `[render skip]`

You can add or remove the above values from an existing PR at any time. If you do, Render creates or deprovisions the associated preview instance accordingly.

> *Your pull request's title might be included in the message for its associated merge commit.*
>
> If you use `[skip render]` or `[render skip]`, this also [skips the auto-deploy](/deploys#skipping-an-auto-deploy) for the service when merged.
>
> To avoid this, instead use `[skip preview]` or `[preview skip]`.

### Working with PR previews

- Preview instances copy all of their settings over from their base service when they're first created. *This includes environment variables, such as database connection information.*

> Make sure to change environment variables on your preview instance if you want it to use a staging or test database.

- Your app can detect whether it's a PR preview by checking the value of the `IS_PULL_REQUEST` environment variable (`true` for a PR preview, `false` otherwise).

- Whenever you push to the branch for an open PR, Render automatically updates the PR preview by building and deploying the latest commit.

- Render *automatically deletes* a PR preview instance when its associated PR is merged or closed.

  - You can _manually_ delete a PR preview instance from its *Settings* tab in the [Render Dashboard](https://dashboard.render.com). However, Render _recreates_ the instance if you push new changes to the associated PR branch.

- If you're using a monorepo, you can fine-tune its PR preview behavior by [defining the root directory or specifying build filters](monorepo-support#using-with-service-previews).

- If you make changes to your base service after creating a PR preview, those changes are _not_ applied to the preview instance.

### Billing for PR previews

*PR Previews are billed at the same rate as your base service.* They are always prorated by the second.

- If your base service is a free static site, its PR previews are also free.
- If your base service costs \$25 per month and one of its PR preview instances is active for _half_ of a month, that preview instance costs a total of \$12.50.

## Image previews

For [image-backed services](/deploying-an-image), you can create a service preview using the [Render API](api). Specifically, you use the [Create service preview](https://api-docs.render.com/reference/preview-service) endpoint:

```
POST https://api.render.com/v1/services/{serviceId}/preview
```

You can add this API request to your CI pipeline to automatically generate an image preview whenever an image tag is created or updated in your container registry. [See an example](#example-github-action).

Preview instances can deploy any tag or digest for the base service's associated Docker image. For details, see the [API reference](https://api-docs.render.com/reference/preview-service).

You can view all active previews from your service's *Previews* tab in the [Render Dashboard](https://dashboard.render.com):

[image: List of image previews in the Render Dashboard]

### Working with image previews

- Preview instances copy all of their settings over from their base service when they're first created. *This includes environment variables, such as database connection information.*

> Make sure to change environment variables on your preview instance if you want it to use a staging or test database.

- *Render does not automatically delete image previews.* Make sure to delete image previews when you're finished with them, either from the Render Dashboard or [via the Render API](https://api-docs.render.com/reference/delete-service).

- If you make changes to your base service after creating an image preview, those changes are _not_ applied to the preview instance.

### Billing for image previews

*An image preview is billed according to the compute plan you specify in your API request.* If you don't specify a compute plan, Render uses the same compute plan as the base service.

> If your base service uses a paid compute plan, its previews can't use the [Free compute plan](free).

### Example GitHub Action

This example uses GitHub Actions and pushes images to Docker Hub, but the high-level steps apply to any combination of CI provider and container registry.

```yaml
# This GitHub Action demonstrates building a Docker image,
# pushing it to Docker Hub, and creating a Render build
# preview with every push to the main branch.
#
# This Action requires setting the following secrets:
#
# - DOCKERHUB_USERNAME
# - DOCKERHUB_ACCESS_TOKEN (create in Docker Hub)
# - RENDER_API_KEY (create from the Account Settings page)
# - RENDER_SERVICE_ID (the service to create a preview for)
#
# You must also set env.DOCKERHUB_REPOSITORY_URL below.
#
# Remember to delete previews when you're done with them!
# You can do this from the Render Dashboard or via the
# Render API.

name: Preview Docker Image on Render

# Fires whenever commits are pushed to the main branch
# (including when a PR is merged)
on:
  push:
    branches: ['main']

env:
  # Replace with the URL for your image's repository
  DOCKERHUB_REPOSITORY_URL: REPLACE_ME
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Check out the repo
        uses: actions/checkout@v5

      - name: Build the Docker image
        run: docker build . --file Dockerfile --tag $DOCKERHUB_REPOSITORY_URL:$(date +%s)

      - name: Log in to Docker Hub
        uses: docker/login-action@v2.2.0
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_ACCESS_TOKEN }}

      - name: Docker Metadata action
        uses: docker/metadata-action@v4.6.0
        id: meta
        with:
          images: ${{env.DOCKERHUB_REPOSITORY_URL}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v4.1.1
        id: build
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

      - name: Create Render service preview
        uses: fjogeleit/http-request-action@v1
        with:
          # Render API endpoint for creating a service preview
          url: 'https://api.render.com/v1/services/${{ secrets.RENDER_SERVICE_ID }}/preview'
          method: 'POST'

          # All Render API requests require a valid API key.
          bearerToken: ${{ secrets.RENDER_API_KEY }}

          # Here we specify the digest of the image we just
          # built. You can alternatively provide the image's
          # tag (main) instead of a digest.
          data: '{"imagePath": "${{ env.DOCKERHUB_REPOSITORY_URL }}@${{ steps.build.outputs.digest }}"}'
```