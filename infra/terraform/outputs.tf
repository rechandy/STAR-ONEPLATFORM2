output "account_id" {
  description = "AWS account the stack is targeting."
  value       = data.aws_caller_identity.current.account_id
}

output "region" {
  description = "AWS region in use."
  value       = data.aws_region.current.name
}

output "name_prefix" {
  description = "Common name prefix for resources."
  value       = local.name_prefix
}
