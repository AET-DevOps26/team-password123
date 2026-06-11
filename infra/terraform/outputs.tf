output "public_ip" {
  description = "Public IP of the VM"
  value       = azurerm_public_ip.main.ip_address
}

output "ssh_command" {
  description = "SSH into the VM"
  value       = "ssh ${var.admin_username}@${azurerm_public_ip.main.ip_address}"
}
