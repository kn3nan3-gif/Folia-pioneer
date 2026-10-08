const crypto = require('node:crypto');
// Strict subset of the LX desktop script contract; never a search provider.
const QUALITY = Object.freeze({ standard: '128k', high: '320k', lossless: 'flac', hires: 'flac24bit' });
const scriptDigest = script => crypto.createHash('sha256').update(script).digest('hex');
function validateInit(data) {
    const wy = data?.sources?.wy;
    if (!wy || !Array.isArray(wy.actions) || !wy.actions.includes('musicUrl')) throw new Error('LX: wy musicUrl not declared');
    if (!Array.isArray(wy.qualitys) || !wy.qualitys.length || wy.qualitys.some(q => !Object.values(QUALITY).includes(q))) throw new Error('LX: invalid quality declaration');
    return [...new Set(wy.qualitys)];
}
function validateAudioUrl(value) {
    if (typeof value !== 'string' || value.length > 2048) throw new Error('LX: invalid audio URL');
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('LX: HTTP(S) audio URL required');
    return url.href;
}
function musicRequest(song, quality, declared) {
    const type = QUALITY[quality];
    if (!type || !declared.includes(type)) throw new Error('LX: unsupported quality');
    const id = String(song.mediaId);
    if (!/^\d{1,20}$/.test(id)) throw new Error('LX: invalid Netease song ID');
    return { source: 'wy', action: 'musicUrl', info: { type, musicInfo: {
        id, name: String(song.name || '').slice(0, 512), singer: String(song.singer || '').slice(0, 512),
        source: 'wy', interval: String(song.interval || '').slice(0, 32),
        meta: { songId: id, qualitys: declared.map(type => ({ type })), _qualitys: Object.fromEntries(declared.map(type => [type, {}])) },
    } } };
}
module.exports = { QUALITY, scriptDigest, validateInit, validateAudioUrl, musicRequest };
