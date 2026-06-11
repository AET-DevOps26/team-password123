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
  description = "CIDR allowed to reach SSH (port 22). Lock this to your IP."
  type        = string
  default     = "0.0.0.0/0"
}
