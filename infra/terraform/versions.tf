terraform {
  required_version = ">= 1.5"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.110"
    }
  }

  # For repeated CI runs, use a remote backend so state persists between runs.
  # Create the storage account once, then uncomment and `terraform init -migrate-state`.
  # backend "azurerm" {
  #   resource_group_name  = "tfstate-rg"
  #   storage_account_name = "calorieasytfstate"
  #   container_name       = "tfstate"
  #   key                  = "azure-vm.tfstate"
  # }
}

provider "azurerm" {
  features {}
}
