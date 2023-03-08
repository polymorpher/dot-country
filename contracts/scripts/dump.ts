// DEPRECATED MARCH 7, 2023

// import dotenv from 'dotenv'
// import fs from 'fs/promises'
// import { ethers } from 'hardhat'
// import { Interface } from 'ethers/lib/utils'
// import { DC } from '../typechain-types'
//
// dotenv.config({ path: '.env.dump' })
//
// const NAMES: string[] = JSON.parse(process.env.NAMES || '[]')
// const CONTRACT = process.env.CONTRACT as string
// const OUT = process.env.OUT
// const ABI_FILE = process.env.ABI_FILE || './abi/DC.json'
// Error.stackTraceLimit = Infinity
// async function main () {
//   if (!CONTRACT) {
//     console.error('Must specify contract address')
//   }
//   console.log({ NAMES, CONTRACT, OUT, ABI_FILE })
//   const abi = await fs.readFile(ABI_FILE, { encoding: 'utf-8' })
//   const signer = await ethers.getNamedSigner('deployer')
//   const c = new ethers.Contract(CONTRACT, new Interface(abi), signer) as DC
//   const records: {name?:string, key: string, record: any}[] = []
//   const len = NAMES.length || (await c.numRecords()).toNumber()
//   const keys: string[] = []
//   const names: {} = {}
//   if (NAMES.length === 0) {
//     for (let i = 0; i < len; i += 50) {
//       const chunk = await c.getRecordKeys(i, Math.min(len, i + 50))
//       keys.push(...chunk)
//     }
//     const n0 = await c.nameRecords(ethers.utils.id(''))
//     names[ethers.utils.id(n0.next)] = n0.next
//   } else {
//     NAMES.forEach(n => {
//       const k = ethers.utils.id(n)
//       names[k] = n
//       keys.push(k)
//     })
//   }
//
//   for (let i = 0; i < len; i++) {
//     const key = keys[i]
//     const record = await c.nameRecords(key)
//     const { renter, rentTime, expirationTime, lastPrice, url, next, prev } = record
//     if (!names[ethers.utils.id(prev)]) {
//       names[ethers.utils.id(prev)] = prev
//     }
//     if (!names[ethers.utils.id(next)]) {
//       names[ethers.utils.id(next)] = next
//     }
//     records.push({ key, record: { renter, rentTime: rentTime.toString(), expirationTime: expirationTime.toString(), lastPrice: lastPrice.toString(), url } })
//   }
//   for (const r of records) {
//     if (!names[r.key]) {
//       console.error(`key ${r.key} has no name, record: ${JSON.stringify(r)}`)
//       throw new Error('Unknown key')
//     }
//     r.name = names[r.key]
//   }
//   if (!OUT) {
//     records.forEach(console.log)
//     return
//   }
//   await fs.writeFile(OUT, JSON.stringify(records))
// }
//
// main().catch((error) => {
//   console.error(error)
//   process.exitCode = 1
// })
