# RAW CAPTURE: Render API Reference, Create service preview (image-backed)

- **Source URL:** https://api-docs.render.com/reference/preview-service (fetched as https://api-docs.render.com/reference/preview-service.md)
- **Fetch date:** 2026-09-12
- **Capture method:** `curl` of Render's API reference `.md` endpoint (returns `text/markdown`), verbatim, unedited below this header.

---

---
updatedAt: 2026-05-29T17:03:57.000Z
---

Fetch the complete documentation index at: https://api-docs.render.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Create service preview (image-backed)

Create a preview instance for an image-backed service. The preview uses the settings of the base service (referenced by `serviceId`), except settings overridden via provided parameters.

View all active previews from your service's Previews tab in the Render Dashboard.

Note that you can't create previews for Git-backed services using the Render API.


# OpenAPI definition

```json
{
  "openapi": "3.0.2",
  "info": {
    "title": "Render Public API",
    "description": "Manage everything about your Render services",
    "version": "1.0.0",
    "contact": {
      "name": "Render API",
      "url": "https://community.render.com",
      "email": "support@render.com"
    }
  },
  "x-readme": {
    "metrics-enabled": false
  },
  "servers": [
    {
      "url": "https://api.render.com/v1"
    }
  ],
  "security": [
    {
      "BearerAuth": []
    }
  ],
  "tags": [
    {
      "name": "Services",
      "description": "[Services](https://render.com/docs/service-types) allow you to manage your web services, private services, background workers, cron jobs, and static sites.\n"
    }
  ],
  "paths": {
    "/services/{serviceId}/autoscaling": {
      "parameters": [
        {
          "$ref": "#/components/parameters/serviceIdParam"
        }
      ],
      "put": {
        "summary": "Update autoscaling config",
        "description": "Update the [autoscaling](https://render.com/docs/scaling#autoscaling) config for the service with the provided ID.\n",
        "operationId": "autoscale-service",
        "tags": [
          "Services"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "enabled",
                  "min",
                  "max",
                  "criteria"
                ],
                "properties": {
                  "enabled": {
                    "type": "boolean",
                    "default": false
                  },
                  "min": {
                    "type": "integer",
                    "description": "The minimum number of instances for the service"
                  },
                  "max": {
                    "type": "integer",
                    "description": "The maximum number of instances for the service"
                  },
                  "criteria": {
                    "type": "object",
                    "required": [
                      "cpu",
                      "memory"
                    ],
                    "properties": {
                      "cpu": {
                        "type": "object",
                        "required": [
                          "enabled",
                          "percentage"
                        ],
                        "properties": {
                          "enabled": {
                            "type": "boolean",
                            "default": false
                          },
                          "percentage": {
                            "type": "integer",
                            "description": "Determines when your service will be scaled. If the average resource utilization is significantly above/below the target, we will increase/decrease the number of instances.\n"
                          }
                        }
                      },
                      "memory": {
                        "$ref": "#/paths/~1services~1{serviceId}~1autoscaling/put/requestBody/content/application~1json/schema/properties/criteria/properties/cpu"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Autoscaling configuration updated",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/paths/~1services~1{serviceId}~1autoscaling/put/requestBody/content/application~1json/schema"
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/400BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/401Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/403Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/404NotFound"
          },
          "406": {
            "$ref": "#/components/responses/406NotAcceptable"
          },
          "410": {
            "$ref": "#/components/responses/410Gone"
          },
          "429": {
            "$ref": "#/components/responses/429RateLimit"
          },
          "500": {
            "$ref": "#/components/responses/500InternalServerError"
          },
          "503": {
            "$ref": "#/components/responses/503ServiceUnavailable"
          }
        }
      }
    },
    "/services/{serviceId}/preview": {
      "parameters": [
        {
          "$ref": "#/components/parameters/serviceIdParam"
        }
      ],
      "post": {
        "summary": "Create service preview (image-backed)",
        "description": "Create a preview instance for an image-backed service. The preview uses the settings of the base service (referenced by `serviceId`), except settings overridden via provided parameters.\n\nView all active previews from your service's Previews tab in the Render Dashboard.\n\nNote that you can't create previews for Git-backed services using the Render API.\n",
        "operationId": "preview-service",
        "tags": [
          "Services"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/previewInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Created",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/serviceAndDeploy"
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/400BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/401Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/403Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/404NotFound"
          },
          "429": {
            "$ref": "#/components/responses/429RateLimit"
          },
          "500": {
            "$ref": "#/components/responses/500InternalServerError"
          },
          "503": {
            "$ref": "#/components/responses/503ServiceUnavailable"
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "BearerAuth": {
        "type": "http",
        "scheme": "bearer"
      }
    },
    "parameters": {
      "serviceIdParam": {
        "name": "serviceId",
        "in": "path",
        "required": true,
        "description": "The ID of the service",
        "schema": {
          "type": "string"
        }
      }
    },
    "schemas": {
      "service": {
        "type": "object",
        "required": [
          "id",
          "name",
          "ownerId",
          "type",
          "createdAt",
          "dashboardUrl",
          "updatedAt",
          "suspended",
          "suspenders",
          "autoDeploy",
          "notifyOnFail",
          "slug",
          "serviceDetails",
          "rootDir"
        ],
        "properties": {
          "id": {
            "type": "string"
          },
          "autoDeploy": {
            "$ref": "#/components/schemas/autoDeploy"
          },
          "branch": {
            "type": "string"
          },
          "buildFilter": {
            "$ref": "#/components/schemas/buildFilter"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "dashboardUrl": {
            "type": "string",
            "description": "The URL to view the service in the Render Dashboard"
          },
          "environmentId": {
            "type": "string"
          },
          "imagePath": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "notifyOnFail": {
            "$ref": "#/components/schemas/notifySetting"
          },
          "ownerId": {
            "type": "string"
          },
          "registryCredential": {
            "$ref": "#/components/schemas/registryCredentialSummary"
          },
          "repo": {
            "type": "string",
            "example": "https://github.com/render-examples/flask-hello-world"
          },
          "rootDir": {
            "type": "string"
          },
          "slug": {
            "type": "string"
          },
          "suspended": {
            "type": "string",
            "title": "serviceSuspendedState",
            "enum": [
              "suspended",
              "not_suspended"
            ]
          },
          "suspenders": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/suspenderType"
            }
          },
          "type": {
            "$ref": "#/components/schemas/serviceType"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          },
          "serviceDetails": {
            "oneOf": [
              {
                "$ref": "#/components/schemas/staticSiteDetails"
              },
              {
                "$ref": "#/components/schemas/webServiceDetails"
              },
              {
                "$ref": "#/components/schemas/privateServiceDetails"
              },
              {
                "$ref": "#/components/schemas/backgroundWorkerDetails"
              },
              {
                "$ref": "#/components/schemas/cronJobDetails"
              }
            ]
          }
        }
      },
      "serviceAndDeploy": {
        "type": "object",
        "properties": {
          "service": {
            "$ref": "#/components/schemas/service"
          },
          "deployId": {
            "type": "string"
          }
        }
      },
      "autoDeploy": {
        "type": "string",
        "enum": [
          "yes",
          "no"
        ],
        "default": "yes"
      },
      "buildFilter": {
        "type": "object",
        "required": [
          "paths",
          "ignoredPaths"
        ],
        "properties": {
          "paths": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "ignoredPaths": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        }
      },
      "registryCredentialSummary": {
        "type": "object",
        "required": [
          "id",
          "name"
        ],
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          }
        }
      },
      "registryCredentialRegistry": {
        "type": "string",
        "enum": [
          "GITHUB",
          "GITLAB",
          "DOCKER",
          "GOOGLE_ARTIFACT",
          "AWS_ECR"
        ],
        "description": "The registry to use this credential with"
      },
      "registryCredential": {
        "type": "object",
        "required": [
          "id",
          "name",
          "username",
          "registry",
          "updatedAt"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "Unique identifier for this credential"
          },
          "name": {
            "type": "string",
            "description": "Descriptive name for this credential"
          },
          "registry": {
            "$ref": "#/components/schemas/registryCredentialRegistry"
          },
          "username": {
            "type": "string",
            "description": "The username associated with the credential"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time",
            "description": "Last updated time for the credential"
          }
        }
      },
      "dockerDetails": {
        "type": "object",
        "required": [
          "dockerCommand",
          "dockerContext",
          "dockerfilePath"
        ],
        "properties": {
          "dockerCommand": {
            "type": "string"
          },
          "dockerContext": {
            "type": "string"
          },
          "dockerfilePath": {
            "type": "string"
          },
          "preDeployCommand": {
            "type": "string"
          },
          "registryCredential": {
            "$ref": "#/components/schemas/registryCredential"
          }
        }
      },
      "nativeEnvironmentDetails": {
        "type": "object",
        "required": [
          "buildCommand",
          "startCommand"
        ],
        "properties": {
          "buildCommand": {
            "type": "string"
          },
          "startCommand": {
            "type": "string"
          },
          "preDeployCommand": {
            "type": "string"
          }
        }
      },
      "staticSiteDetails": {
        "type": "object",
        "required": [
          "buildCommand",
          "publishPath",
          "url",
          "buildPlan"
        ],
        "properties": {
          "buildCommand": {
            "type": "string"
          },
          "ipAllowList": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/cidrBlockAndDescription"
            }
          },
          "parentServer": {
            "$ref": "#/components/schemas/resource"
          },
          "publishPath": {
            "type": "string"
          },
          "pullRequestPreviewsEnabled": {
            "$ref": "#/components/schemas/pullRequestPreviewsEnabled"
          },
          "previews": {
            "$ref": "#/components/schemas/previews"
          },
          "url": {
            "type": "string"
          },
          "buildPlan": {
            "$ref": "#/components/schemas/buildPlan"
          },
          "renderSubdomainPolicy": {
            "$ref": "#/components/schemas/renderSubdomainPolicy"
          }
        }
      },
      "maintenanceMode": {
        "type": "object",
        "required": [
          "enabled",
          "uri"
        ],
        "properties": {
          "enabled": {
            "type": "boolean"
          },
          "uri": {
            "type": "string",
            "description": "The page to be served when [maintenance mode](https://render.com/docs/maintenance-mode) is enabled. When empty, the default maintenance mode page is served."
          }
        }
      },
      "maxShutdownDelaySeconds": {
        "type": "integer",
        "description": "The maximum amount of time (in seconds) that Render waits for your application process to exit gracefully after sending it a SIGTERM signal.",
        "minimum": 1,
        "maximum": 300,
        "default": 30
      },
      "webServiceDetails": {
        "type": "object",
        "required": [
          "env",
          "runtime",
          "envSpecificDetails",
          "plan",
          "region",
          "numInstances",
          "buildPlan",
          "healthCheckPath",
          "openPorts",
          "url"
        ],
        "properties": {
          "autoscaling": {
            "$ref": "#/paths/~1services~1{serviceId}~1autoscaling/put/requestBody/content/application~1json/schema"
          },
          "cache": {
            "$ref": "#/components/schemas/cache"
          },
          "disk": {
            "type": "object",
            "required": [
              "id",
              "name",
              "sizeGB",
              "mountPath"
            ],
            "properties": {
              "id": {
                "$ref": "#/paths/~1disks~1{diskId}/parameters/0/schema"
              },
              "name": {
                "type": "string"
              },
              "sizeGB": {
                "type": "integer"
              },
              "mountPath": {
                "type": "string"
              }
            }
          },
          "env": {
            "$ref": "#/components/schemas/serviceEnv"
          },
          "envSpecificDetails": {
            "$ref": "#/components/schemas/envSpecificDetails"
          },
          "healthCheckPath": {
            "type": "string"
          },
          "ipAllowList": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/cidrBlockAndDescription"
            }
          },
          "maintenanceMode": {
            "$ref": "#/components/schemas/maintenanceMode"
          },
          "numInstances": {
            "type": "integer",
            "description": "For a *manually* scaled service, this is the number of instances the service is scaled to. DOES NOT indicate the number of running instances for an *autoscaled* service."
          },
          "openPorts": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/serverPort"
            }
          },
          "parentServer": {
            "$ref": "#/components/schemas/resource"
          },
          "plan": {
            "$ref": "#/components/schemas/plan"
          },
          "pullRequestPreviewsEnabled": {
            "$ref": "#/components/schemas/pullRequestPreviewsEnabled"
          },
          "previews": {
            "$ref": "#/components/schemas/previews"
          },
          "region": {
            "$ref": "#/components/schemas/region"
          },
          "runtime": {
            "$ref": "#/components/schemas/serviceRuntime"
          },
          "sshAddress": {
            "$ref": "#/components/schemas/sshAddress"
          },
          "url": {
            "type": "string"
          },
          "buildPlan": {
            "$ref": "#/components/schemas/buildPlan"
          },
          "maxShutdownDelaySeconds": {
            "$ref": "#/components/schemas/maxShutdownDelaySeconds"
          },
          "renderSubdomainPolicy": {
            "$ref": "#/components/schemas/renderSubdomainPolicy"
          }
        }
      },
      "envSpecificDetails": {
        "oneOf": [
          {
            "$ref": "#/components/schemas/dockerDetails"
          },
          {
            "$ref": "#/components/schemas/nativeEnvironmentDetails"
          }
        ]
      },
      "resource": {
        "required": [
          "id",
          "name"
        ],
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          }
        }
      },
      "privateServiceDetails": {
        "type": "object",
        "required": [
          "env",
          "runtime",
          "envSpecificDetails",
          "plan",
          "region",
          "numInstances",
          "buildPlan",
          "openPorts",
          "url"
        ],
        "properties": {
          "autoscaling": {
            "$ref": "#/paths/~1services~1{serviceId}~1autoscaling/put/requestBody/content/application~1json/schema"
          },
          "disk": {
            "$ref": "#/components/schemas/webServiceDetails/properties/disk"
          },
          "env": {
            "$ref": "#/components/schemas/serviceEnv"
          },
          "envSpecificDetails": {
            "$ref": "#/components/schemas/envSpecificDetails"
          },
          "numInstances": {
            "type": "integer",
            "description": "For a *manually* scaled service, this is the number of instances the service is scaled to. DOES NOT indicate the number of running instances for an *autoscaled* service."
          },
          "openPorts": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/serverPort"
            }
          },
          "parentServer": {
            "$ref": "#/components/schemas/resource"
          },
          "plan": {
            "$ref": "#/components/schemas/plan"
          },
          "pullRequestPreviewsEnabled": {
            "$ref": "#/components/schemas/pullRequestPreviewsEnabled"
          },
          "previews": {
            "$ref": "#/components/schemas/previews"
          },
          "region": {
            "$ref": "#/components/schemas/region"
          },
          "runtime": {
            "$ref": "#/components/schemas/serviceRuntime"
          },
          "sshAddress": {
            "$ref": "#/components/schemas/sshAddress"
          },
          "url": {
            "type": "string"
          },
          "buildPlan": {
            "$ref": "#/components/schemas/buildPlan"
          },
          "maxShutdownDelaySeconds": {
            "$ref": "#/components/schemas/maxShutdownDelaySeconds"
          }
        }
      },
      "cache": {
        "type": "object",
        "required": [
          "profile"
        ],
        "properties": {
          "profile": {
            "type": "string",
            "enum": [
              "no-cache",
              "origin-controlled",
              "origin-controlled-all"
            ],
            "default": "no-cache"
          }
        }
      },
      "backgroundWorkerDetails": {
        "type": "object",
        "required": [
          "env",
          "runtime",
          "envSpecificDetails",
          "plan",
          "region",
          "numInstances",
          "buildPlan"
        ],
        "properties": {
          "autoscaling": {
            "$ref": "#/paths/~1services~1{serviceId}~1autoscaling/put/requestBody/content/application~1json/schema"
          },
          "disk": {
            "$ref": "#/components/schemas/webServiceDetails/properties/disk"
          },
          "env": {
            "$ref": "#/components/schemas/serviceEnv"
          },
          "envSpecificDetails": {
            "$ref": "#/components/schemas/envSpecificDetails"
          },
          "numInstances": {
            "type": "integer",
            "description": "For a *manually* scaled service, this is the number of instances the service is scaled to. DOES NOT indicate the number of running instances for an *autoscaled* service."
          },
          "parentServer": {
            "$ref": "#/components/schemas/resource"
          },
          "plan": {
            "$ref": "#/components/schemas/plan"
          },
          "pullRequestPreviewsEnabled": {
            "$ref": "#/components/schemas/pullRequestPreviewsEnabled"
          },
          "previews": {
            "$ref": "#/components/schemas/previews"
          },
          "region": {
            "$ref": "#/components/schemas/region"
          },
          "runtime": {
            "$ref": "#/components/schemas/serviceRuntime"
          },
          "sshAddress": {
            "$ref": "#/components/schemas/sshAddress"
          },
          "buildPlan": {
            "$ref": "#/components/schemas/buildPlan"
          },
          "maxShutdownDelaySeconds": {
            "$ref": "#/components/schemas/maxShutdownDelaySeconds"
          }
        }
      },
      "cronJobDetails": {
        "required": [
          "env",
          "runtime",
          "envSpecificDetails",
          "plan",
          "region",
          "schedule",
          "buildPlan"
        ],
        "type": "object",
        "properties": {
          "env": {
            "$ref": "#/components/schemas/serviceEnv"
          },
          "envSpecificDetails": {
            "$ref": "#/components/schemas/envSpecificDetails"
          },
          "lastSuccessfulRunAt": {
            "type": "string",
            "format": "date-time"
          },
          "plan": {
            "$ref": "#/components/schemas/plan"
          },
          "region": {
            "$ref": "#/components/schemas/region"
          },
          "runtime": {
            "$ref": "#/components/schemas/serviceRuntime"
          },
          "schedule": {
            "type": "string"
          },
          "buildPlan": {
            "$ref": "#/components/schemas/buildPlan"
          }
        }
      },
      "previewInput": {
        "type": "object",
        "required": [
          "imagePath"
        ],
        "properties": {
          "imagePath": {
            "type": "string",
            "example": "docker.io/library/nginx:latest",
            "description": "Must be either a full URL or the relative path to an image. If a relative path, Render uses the base service's image URL as its root. For example, if the base service's image URL is `docker.io/library/nginx:latest`, then valid values are: `docker.io/library/nginx:<any tag or SHA>`, `library/nginx:<any tag or SHA>`, or `nginx:<any tag or SHA>`. Note that the path must match (only the tag or SHA can vary)."
          },
          "name": {
            "type": "string",
            "example": "preview",
            "description": "A name for the service preview instance. If not specified, Render generates the name using the base service's name and the specified tag or SHA."
          },
          "plan": {
            "$ref": "#/components/schemas/plan"
          }
        }
      },
      "plan": {
        "type": "string",
        "enum": [
          "starter",
          "starter_plus",
          "standard",
          "standard_plus",
          "pro",
          "pro_plus",
          "pro_max",
          "pro_ultra",
          "free",
          "custom",
          "starter_legacy",
          "standard_legacy",
          "standard_plus_legacy",
          "pro_legacy",
          "pro_plus_legacy",
          "0.5c-512mb",
          "1c-2g",
          "2c-4g",
          "2c-8g",
          "2c-16g",
          "4c-8g",
          "4c-16g",
          "4c-32g",
          "8c-16g",
          "8c-32g",
          "8c-64g",
          "12c-24g",
          "12c-48g",
          "12c-96g"
        ],
        "example": "starter",
        "description": "The compute plan to use. Legacy variants (`*_legacy`) identify grandfathered plans no longer offered for new services. Note that base services on any paid compute plan can't create preview instances with the `free` plan."
      },
      "serviceType": {
        "type": "string",
        "enum": [
          "static_site",
          "web_service",
          "private_service",
          "background_worker",
          "cron_job"
        ]
      },
      "serviceRuntime": {
        "type": "string",
        "enum": [
          "docker",
          "elixir",
          "go",
          "node",
          "python",
          "ruby",
          "rust",
          "image"
        ],
        "description": "Runtime"
      },
      "serviceEnv": {
        "type": "string",
        "enum": [
          "docker",
          "elixir",
          "go",
          "node",
          "python",
          "ruby",
          "rust",
          "image"
        ],
        "deprecated": true,
        "description": "This field has been deprecated, runtime should be used in its place."
      },
      "sshAddress": {
        "type": "string",
        "description": "The SSH address for the service. Only present for services that have SSH enabled."
      },
      "region": {
        "type": "string",
        "enum": [
          "frankfurt",
          "oregon",
          "ohio",
          "singapore",
          "virginia"
        ],
        "default": "oregon",
        "description": "Defaults to \"oregon\""
      },
      "notifySetting": {
        "type": "string",
        "enum": [
          "default",
          "notify",
          "ignore"
        ]
      },
      "suspenderType": {
        "type": "string",
        "enum": [
          "admin",
          "billing",
          "user",
          "parent_service",
          "stuck_crashlooping",
          "hipaa_enablement",
          "unknown"
        ]
      },
      "serverPort": {
        "type": "object",
        "required": [
          "port",
          "protocol"
        ],
        "properties": {
          "port": {
            "type": "integer",
            "example": 10000
          },
          "protocol": {
            "type": "string",
            "enum": [
              "TCP",
              "UDP"
            ]
          }
        }
      },
      "error": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "message": {
            "type": "string"
          },
          "code": {
            "type": "string",
            "description": "A stable, machine-readable identifier present on specific errors that clients can handle specially. Each endpoint documents the codes it can return. The errorCode schema lists the full vocabulary of codes."
          }
        }
      },
      "pullRequestPreviewsEnabled": {
        "type": "string",
        "enum": [
          "yes",
          "no"
        ],
        "default": "no",
        "deprecated": true,
        "description": "This field has been deprecated. previews.generation should be used in its place."
      },
      "previews": {
        "type": "object",
        "properties": {
          "generation": {
            "type": "string",
            "enum": [
              "off",
              "manual",
              "automatic"
            ],
            "default": "off",
            "description": "Defaults to \"off\""
          }
        }
      },
      "buildPlan": {
        "type": "string",
        "enum": [
          "starter",
          "performance"
        ],
        "default": "starter"
      },
      "renderSubdomainPolicy": {
        "type": "string",
        "enum": [
          "enabled",
          "disabled"
        ],
        "description": "Controls whether render.com subdomains are available for the service"
      },
      "cidrBlockAndDescription": {
        "type": "object",
        "required": [
          "cidrBlock",
          "description"
        ],
        "properties": {
          "cidrBlock": {
            "type": "string"
          },
          "description": {
            "description": "User-provided description of the CIDR block",
            "type": "string"
          }
        }
      }
    },
    "responses": {
      "400BadRequest": {
        "description": "The request could not be understood by the server.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/error"
            }
          }
        }
      },
      "401Unauthorized": {
        "description": "Authorization information is missing or invalid.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/error"
            }
          }
        }
      },
      "403Forbidden": {
        "description": "You do not have permissions for the requested resource.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/error"
            }
          }
        }
      },
      "404NotFound": {
        "description": "Unable to find the requested resource.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/error"
            }
          }
        }
      },
      "429RateLimit": {
        "description": "Rate limit has been surpassed.\n\nRate-limited endpoints also return `RateLimit-Limit`, `RateLimit-Remaining`, and\n`RateLimit-Reset` on successful responses so clients can track their remaining quota.\n",
        "headers": {
          "Retry-After": {
            "description": "Seconds to wait before retrying the request.",
            "schema": {
              "type": "integer",
              "example": 30
            }
          },
          "RateLimit-Limit": {
            "description": "Maximum number of requests allowed in the current window.",
            "schema": {
              "type": "integer",
              "example": 100
            }
          },
          "RateLimit-Remaining": {
            "description": "Number of requests remaining in the current window. Always `0` for this response.",
            "schema": {
              "type": "integer",
              "example": 0
            }
          },
          "RateLimit-Reset": {
            "description": "Seconds until the current rate limit window resets.",
            "schema": {
              "type": "integer",
              "example": 30
            }
          }
        },
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/error"
            },
            "example": {
              "message": "rate limit exceeded"
            }
          }
        }
      },
      "500InternalServerError": {
        "description": "An unexpected server error has occurred.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/error"
            }
          }
        }
      },
      "503ServiceUnavailable": {
        "description": "Server currently unavailable.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/error"
            }
          }
        }
      }
    }
  }
}
```