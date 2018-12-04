'use strict'

require('stringify').registerWithRequire(['.html', '.gqls'])

const express = require('express')

const adminWebsite = require('./splight/adminWebsite')

async function main (dataGitRemote) {
  console.log('Starting developer website...')

  const app = express()

  app.use(await adminWebsite.makeRouter({
    dataGitRemote,
    scripts: []
  }))

  app.listen(8000, () => console.log('Listening at http://localhost:80/'))
}

main(process.argv[2])
