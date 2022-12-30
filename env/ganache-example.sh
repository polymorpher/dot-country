#!/usr/bin/env bash
export MNEMONIC="test test test test test test test test test test test junk"
#ganache -b 2 -m "${MNEMONIC}" --server.ws --database.dbPath "./db"
ganache -m "${MNEMONIC}" --server.ws --database.dbPath "./db"