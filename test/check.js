'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const test = require('tap').test

const ssri = require('..')

const TEST_DATA = fs.readFileSync(__filename)

function hash (data, algorithm) {
  return crypto.createHash(algorithm).update(data).digest('base64')
}

function fileStream () {
  return fs.createReadStream(__filename)
}

test('checkData', t => {
  const sri = ssri.parse({
    algorithm: 'sha512',
    digest: hash(TEST_DATA, 'sha512')
  })
  const meta = sri['sha512'][0]
  t.deepEqual(
    ssri.checkData(TEST_DATA, sri),
    meta,
    'Buffer data successfully verified'
  )
  t.deepEqual(
    ssri.checkData(TEST_DATA, `sha512-${hash(TEST_DATA, 'sha512')}`),
    meta,
    'Accepts string SRI'
  )
  t.deepEqual(
    ssri.checkData(TEST_DATA, {
      algorithm: 'sha512',
      digest: hash(TEST_DATA, 'sha512')
    }),
    meta,
    'Accepts IntegrityMetadata-like SRI'
  )
  t.deepEqual(
    ssri.checkData(TEST_DATA.toString('utf8'), sri),
    meta,
    'String data successfully verified'
  )
  t.deepEqual(
    ssri.checkData(
      TEST_DATA,
      `sha512-nope sha512-${hash(TEST_DATA, 'sha512')}`
    ),
    meta,
    'succeeds if any of the hashes under the chosen algorithm match'
  )
  t.equal(
    ssri.checkData('nope', sri),
    false,
    'returns false when verification fails'
  )
  t.deepEqual(
    ssri.checkData(TEST_DATA, [
      'sha512-nope',
      `sha1-${hash(TEST_DATA, 'sha1')}`,
      `sha512-${hash(TEST_DATA, 'sha512')}`
    ].join(' '), {
      pickAlgorithm: (a, b) => {
        if (a === 'sha1' || b === 'sha1') { return 'sha1' }
      }
    }),
    ssri.parse({
      algorithm: 'sha1', digest: hash(TEST_DATA, 'sha1')
    })['sha1'][0],
    'opts.pickAlgorithm can be used to customize which one is used.'
  )
  t.deepEqual(
    ssri.checkData(TEST_DATA, [
      `sha1-${hash(TEST_DATA, 'sha1')}`,
      `sha384-${hash(TEST_DATA, 'sha384')}`,
      `sha256-${hash(TEST_DATA, 'sha256')}`
    ].join(' ')),
    ssri.parse({
      algorithm: 'sha384', digest: hash(TEST_DATA, 'sha384')
    })['sha384'][0],
    'picks the "strongest" available algorithm, by default'
  )
  t.done()
})

test('checkStream', t => {
  const sri = ssri.parse({
    algorithm: 'sha512',
    digest: hash(TEST_DATA, 'sha512')
  })
  const meta = sri['sha512'][0]
  let streamEnded
  const stream = fileStream().on('end', () => { streamEnded = true })
  return ssri.checkStream(stream, sri).then(res => {
    t.deepEqual(res, meta, 'Stream data successfully verified')
    t.ok(streamEnded, 'source stream ended')
    return ssri.checkStream(
      fileStream(),
      `sha512-${hash(TEST_DATA, 'sha512')}`
    )
  }).then(res => {
    t.deepEqual(res, meta, 'Accepts string SRI')
    return ssri.checkStream(fileStream(), {
      algorithm: 'sha512',
      digest: hash(TEST_DATA, 'sha512')
    })
  }).then(res => {
    t.deepEqual(res, meta, 'Accepts IntegrityMetadata-like SRI')
    return ssri.checkStream(
      fileStream(),
      `sha512-nope sha512-${hash(TEST_DATA, 'sha512')}`
    )
  }).then(res => {
    t.deepEqual(
      res,
      meta,
      'succeeds if any of the hashes under the chosen algorithm match'
    )
    return ssri.checkStream(
      fs.createReadStream(path.join(__dirname, '..', 'package.json')),
      sri
    ).then(() => {
      throw new Error('unexpected success')
    }, err => {
      t.equal(err.code, 'EBADCHECKSUM', 'checksum failure rejects the promise')
    })
  }).then(() => {
    return ssri.checkStream(fileStream(), [
      'sha512-nope',
      `sha1-${hash(TEST_DATA, 'sha1')}`,
      `sha512-${hash(TEST_DATA, 'sha512')}`
    ].join(' '), {
      pickAlgorithm: (a, b) => {
        if (a === 'sha1' || b === 'sha1') { return 'sha1' }
      }
    })
  }).then(res => {
    t.deepEqual(
      res,
      ssri.parse({
        algorithm: 'sha1', digest: hash(TEST_DATA, 'sha1')
      })['sha1'][0],
      'opts.pickAlgorithm can be used to customize which one is used.'
    )
    return ssri.checkStream(fileStream(), [
      `sha1-${hash(TEST_DATA, 'sha1')}`,
      `sha384-${hash(TEST_DATA, 'sha384')}`,
      `sha256-${hash(TEST_DATA, 'sha256')}`
    ].join(' '))
  }).then(res => {
    t.deepEqual(
      res,
      ssri.parse({
        algorithm: 'sha384', digest: hash(TEST_DATA, 'sha384')
      })['sha384'][0],
      'picks the "strongest" available algorithm, by default'
    )
    return ssri.checkStream(
      fileStream(), `sha256-${hash(TEST_DATA, 'sha256')}`, {
        size: TEST_DATA.length - 1
      }
    ).then(() => {
      throw new Error('unexpected success')
    }, err => {
      t.equal(err.code, 'EBADSIZE', 'size check failure rejects the promise')
    })
  })
})
