import * as dotenv from 'dotenv'
import fs from 'fs/promises'
import { ethers } from 'hardhat'
import TweetAbi from '../abi/Tweet.json'
import { Tweet } from '../typechain-types'
dotenv.config({ path: '.env.dump' })

const TWEET_CONTRACT = process.env.TWEET_CONTRACT as string
const PROVIDER = process.env.PROVIDER as string
const OUT = process.env.OUT as string

async function main () {
  const tt = new ethers.Contract(TWEET_CONTRACT, TweetAbi, new ethers.providers.StaticJsonRpcProvider(PROVIDER)) as Tweet
  const data: {[key:string]: string[]} = JSON.parse(await fs.readFile(OUT, { encoding: 'utf-8' }))
  const keys = Object.keys(data)
  for (let i = 0; i < keys.length; i += 50) {
    const chunk = keys.slice(i, Math.min(keys.length, i + 50))
    console.log(`Calldata for activating ${i}-${Math.min(keys.length, i + 50)}`, chunk)
    const calldata = tt.interface.encodeFunctionData('initializeActivation', [chunk.map(e => ethers.utils.id(e))])
    console.log(calldata)
  }
  const denseKeys = keys.filter(k => data[k].length > 0)
  for (const k of denseKeys) {
    console.log(`Calldata for initializing url for [${k}] on urls:`, data[k])
    const calldata = tt.interface.encodeFunctionData('initializeUrls', [ethers.utils.id(k), data[k]])
    console.log(calldata)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
