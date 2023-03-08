#!/usr/bin/env bash

rm -rf db

# Use if you want to emulate 2-seconds per block
# ganache -b 2 --server.ws --database.dbPath "./db" -m "test test test test test test test test test test test junk"

# Use for fast tests
ganache --server.ws --database.dbPath "./db" -m "test test test test test test test test test test test junk"