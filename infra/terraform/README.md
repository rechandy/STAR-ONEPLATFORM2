# OnePlatform Infrastructure (Terraform)

Phase 0 **stub** for the AWS landing zone. It establishes the Terraform skeleton —
provider, versions, variables, tagging, remote-state placeholder — so the platform team can
add modules (network → EKS → data → identity → eventing) incrementally per
[`docs/architecture/01-blueprint.md`](../../docs/architecture/01-blueprint.md) §4.

## Layout

```
infra/terraform/
  versions.tf        # required_version + AWS provider (+ commented S3 backend)
  providers.tf       # aws provider with default_tags
  variables.tf       # project / environment / aws_region (validated)
  main.tf            # locals, identity data sources, planned module placeholders
  outputs.tf         # account_id, region, name_prefix
  environments/      # per-env tfvars (dev/staging/prod)
```

## Usage

```bash
cd infra/terraform
terraform init
terraform plan  -var-file=environments/dev.tfvars
# terraform apply -var-file=environments/dev.tfvars
```

> No billable resources are defined yet — `plan` only reads caller identity/region to verify
> credentials and region wiring. Set up the **remote state** S3 bucket + DynamoDB lock table
> first (bootstrap), then uncomment the `backend "s3"` block in `versions.tf`.

## Conventions

- One state per environment via `-var-file` (later: separate backends/workspaces per env).
- All resources inherit `local.common_tags` through the provider's `default_tags`.
- Name resources with `local.name_prefix` (`oneplatform-dev`, …).
