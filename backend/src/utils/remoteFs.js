'use strict';

const Client = require('ssh2-sftp-client');
const RemoteConnection = require('../models/RemoteConnection');
const logger = require('./logger');

// Cache of active SFTP clients
const activeClients = new Map();

/**
 * Get or create an SFTP client for a given connection ID
 */
async function getClient(connectionId, userId) {
  const cacheKey = `${userId}:${connectionId}`;
  
  if (activeClients.has(cacheKey)) {
    return activeClients.get(cacheKey);
  }

  const connData = await RemoteConnection.findOne({ _id: connectionId, userId });
  if (!connData) {
    throw new Error('Remote connection not found');
  }

  const sftp = new Client();
  
  try {
    await sftp.connect({
      host: connData.host,
      port: connData.port,
      username: connData.username,
      password: connData.password || undefined,
      privateKey: connData.privateKey || undefined,
      readyTimeout: 10000,
    });
    
    activeClients.set(cacheKey, sftp);
    
    sftp.on('end', () => activeClients.delete(cacheKey));
    sftp.on('error', () => activeClients.delete(cacheKey));
    sftp.on('close', () => activeClients.delete(cacheKey));
    
    return sftp;
  } catch (err) {
    logger.error({ err, connectionId }, 'Failed to connect to SFTP');
    throw err;
  }
}

/**
 * List directory contents via SFTP
 */
async function listDir(connectionId, userId, dirPath = '.') {
  const sftp = await getClient(connectionId, userId);
  const items = await sftp.list(dirPath);
  
  // Normalize items to match local FS format
  const result = items.map(item => ({
    name: item.name,
    path: dirPath === '.' || dirPath === '/' ? `/${item.name}` : `${dirPath}/${item.name}`,
    isDirectory: item.type === 'd'
  })).sort((a, b) => {
    if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
    return a.isDirectory ? -1 : 1;
  });

  return { path: dirPath, items: result };
}

/**
 * Read file contents via SFTP
 */
async function readFile(connectionId, userId, filePath) {
  const sftp = await getClient(connectionId, userId);
  const buffer = await sftp.get(filePath);
  return buffer.toString('utf8');
}

/**
 * Write file contents via SFTP
 */
async function writeFile(connectionId, userId, filePath, content) {
  const sftp = await getClient(connectionId, userId);
  await sftp.put(Buffer.from(content, 'utf8'), filePath);
  return { success: true };
}

/**
 * Rename file or directory via SFTP
 */
async function renamePath(connectionId, userId, oldPath, newPath) {
  const sftp = await getClient(connectionId, userId);
  await sftp.rename(oldPath, newPath);
  return { success: true };
}

/**
 * Delete file or directory via SFTP
 */
async function deletePath(connectionId, userId, targetPath) {
  const sftp = await getClient(connectionId, userId);
  const type = await sftp.exists(targetPath);
  if (type === 'd') {
    await sftp.rmdir(targetPath, true); // true = recursive
  } else if (type === '-' || type === 'l') {
    await sftp.delete(targetPath);
  } else {
    throw new Error('Path not found on remote server');
  }
  return { success: true };
}

/**
 * Copy file (Remote to Remote) via streams
 */
async function copyPath(connectionId, userId, srcPath, destPath) {
  const sftp = await getClient(connectionId, userId);
  const type = await sftp.exists(srcPath);
  
  if (type === 'd') {
    throw new Error('Copying directories over SFTP is not supported in this version');
  } else if (type === '-') {
    const stream = sftp.createReadStream(srcPath);
    await sftp.put(stream, destPath);
  } else {
    throw new Error('Source path not found');
  }
}

module.exports = {
  listDir,
  readFile,
  writeFile,
  renamePath,
  deletePath,
  copyPath
};
