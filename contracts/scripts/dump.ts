import * as dotenv from 'dotenv'
import fs from 'fs/promises'
import { ethers } from 'hardhat'
import { Tweet } from '../typechain-types'
import TweetAbi from '../abi/Tweet.json'

dotenv.config({ path: '.env.dump' })

const TWEET_CONTRACT = process.env.TWEET_CONTRACT as string
const OUT = process.env.OUT as string
const NAMES_FILE = process.env.NAMES_FILE as string
const PROVIDER = process.env.PROVIDER as string

async function main () {
  if (!TWEET_CONTRACT) {
    console.error('Must specify contract address')
    return
  }
  const names = (await fs.readFile(NAMES_FILE, { encoding: 'utf-8' })).split('\n')
  const tt = new ethers.Contract(TWEET_CONTRACT, TweetAbi, new ethers.providers.StaticJsonRpcProvider(PROVIDER)) as Tweet
  const dump = {}
  for (const n of names) {
    const p = n.split('.')[0]
    dump[p] = await tt.getAllUrls(p)
    console.log(`Processed ${p}, urls: ${JSON.stringify(dump[p])}`)
  }
  await fs.writeFile(OUT, JSON.stringify(dump))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
