#!/bin/bash

# Install Docker on Ubuntu VPS
# For Ubuntu 22.04 LTS on Hostinger VPS

set -euo pipefail

echo "================================================"
echo "   Installing Docker on VPS"
echo "================================================"
echo ""

# Update system packages
echo "Step 1: Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

echo ""
echo "Step 2: Installing prerequisites..."
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

echo ""
echo "Step 3: Adding Docker's official GPG key..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo ""
echo "Step 4: Setting up Docker repository..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

echo ""
echo "Step 5: Installing Docker Engine..."
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo ""
echo "Step 6: Installing Docker Compose standalone..."
# Install Docker Compose v2 standalone
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

echo ""
echo "Step 7: Starting Docker service..."
sudo systemctl start docker
sudo systemctl enable docker

echo ""
echo "Step 8: Adding current user to docker group..."
sudo usermod -aG docker $USER

echo ""
echo "Step 9: Verifying installation..."
sudo docker --version
sudo docker-compose --version

echo ""
echo "Step 10: Running test container..."
sudo docker run hello-world

echo ""
echo "================================================"
echo "   Docker Installation Complete!"
echo "================================================"
echo ""
echo "Docker version:"
sudo docker --version
echo ""
echo "Docker Compose version:"
sudo docker-compose --version
echo ""
echo "IMPORTANT: You need to log out and back in for group changes to take effect."
echo "Or run: newgrp docker"
echo "================================================"