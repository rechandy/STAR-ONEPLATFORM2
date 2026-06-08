terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }

  # Remote state — uncomment and configure once the bootstrap bucket/table exist.
  # backend "s3" {
  #   bucket         = "oneplatform-tfstate-<account-id>"
  #   key            = "global/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "oneplatform-tflock"
  #   encrypt        = true
  # }
}
