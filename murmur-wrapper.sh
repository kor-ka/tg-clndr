#!/bin/bash
# Wrapper script for murmur-chat with proxy support
cd /tmp/murmur-test
NODE_TLS_REJECT_UNAUTHORIZED=0 node --import ./proxy-loader.mjs /opt/node22/lib/node_modules/murmur-chat/dist/cli.mjs "$@"
