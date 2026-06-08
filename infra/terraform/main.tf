// ============================================================================
// OnePlatform — AWS landing zone (Phase 0 STUB)
// ----------------------------------------------------------------------------
// This is an intentionally minimal, valid starting point. Real infrastructure
// (VPC, EKS, Aurora, MSK, S3, Cognito, etc. — see docs/architecture/01-blueprint.md
// §4) is added in modules under ./modules and composed here as the platform team
// builds out Phase 0/1.
// ============================================================================

locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
    Repo        = "STAR-ONEPLATFORM"
  }
}

# Confirms credentials/region wiring with `terraform plan` before any resources exist.
data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# ---------------------------------------------------------------------------
# Planned modules (uncomment & implement incrementally):
#
# module "network" {            # VPC, subnets, NAT, security groups
#   source      = "./modules/network"
#   name_prefix = local.name_prefix
# }
#
# module "eks" {                # EKS cluster + node groups / Fargate profiles
#   source      = "./modules/eks"
#   name_prefix = local.name_prefix
#   subnet_ids  = module.network.private_subnet_ids
# }
#
# module "data" {              # Aurora PostgreSQL, ElastiCache, MSK, OpenSearch
#   source      = "./modules/data"
#   name_prefix = local.name_prefix
# }
# ---------------------------------------------------------------------------
