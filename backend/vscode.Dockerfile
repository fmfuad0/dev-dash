FROM debian:bullseye-slim

# Install only the bare minimum dependencies for downloading and running VS Code server
RUN apt-get update && apt-get install -y \
    curl \
    tar \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Download and install the official Microsoft VS Code CLI
# We use the official linux-x64 endpoint so it pulls the glibc VS Code server, which matches Debian perfectly.
RUN curl -Lk 'https://update.code.visualstudio.com/latest/cli-linux-x64/stable' --output vscode_cli.tar.gz \
    && tar -xzf vscode_cli.tar.gz -C /usr/local/bin \
    && rm vscode_cli.tar.gz \
    && chmod +x /usr/local/bin/code

# Pre-create all required VS Code data directories.
RUN mkdir -p \
      /vscode-data/User/globalStorage \
      /vscode-data/extensions \
    && for letter in a b c d e f g h i j k l m n o p q r s t u v w x y z; do \
         mkdir -p /mnt/$letter; \
       done \
    && chmod -R 777 /vscode-data

WORKDIR /

# Start VS Code Web Server.
CMD ["code", "serve-web", \
     "--host",              "0.0.0.0", \
     "--port",              "8000", \
     "--without-connection-token", \
     "--accept-server-license-terms", \
     "--server-data-dir",  "/vscode-data", \
     "--cli-data-dir",     "/vscode-data/cli", \
     "--server-base-path", "/vscode"]
