variable "prefix" {
  description = "Name prefix for all resources"
  type        = string
  default     = "calorieasy"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "germanywestcentral"
}

variable "vm_size" {
  description = "VM size"
  type        = string
  default     = "Standard_B2s"
}

variable "admin_username" {
  description = "Admin username on the VM"
  type        = string
  default     = "azureuser"
}

variable "ssh_public_key" {
  description = "SSH public key for the admin user (the key contents, not a path)"
  type        = string
}

variable "allowed_ssh_cidr" {
  # No default on purpose: SSH to a public IP must fail closed. `terraform apply`
  # will prompt (or error in CI) until an operator supplies their own /32 or a
  # jump-host CIDR, instead of silently exposing sshd to the whole internet.
  description = "CIDR allowed to reach SSH (port 22). Lock this to your IP, e.g. 203.0.113.4/32."
  type        = string
}
