const { scriptDigest } = require('./contract.cjs');
// Derived conservative lexical hints, never a parser or proof of safety.
const REVIEW_VERSION = 'lexical-1';
const RISK_VERSION = 'browser-webrtc-1';
function reviewScript(script) {
    const findings = [];
    const rules = [
        ['dynamic-code', /\b(?:eval|Function|importScripts)\b|\bimport\s*\(/],
        ['browser-network', /\b(?:fetch|XMLHttpRequest|WebSocket|Worker|RTCPeerConnection|sendBeacon)\b/],
        ['obfuscation-hint', /\\[xu][0-9a-fA-F]{2,}|\batob\b|[A-Za-z0-9+/]{200,}/],
        ['unsupported-api', /\b(?:crypto|zlib|buffer|updateAlert|showConfigView)\b/],
    ];
    for (const [id, pattern] of rules) if (pattern.test(script)) findings.push(id);
    const domains = new Set();
    for (const match of script.matchAll(/https?:\/\/[^\s'"`<>\\]+/g)) {
        try { domains.add(new URL(match[0]).hostname); } catch (_error) { findings.push('unparsed-url'); }
    }
    return { digest: scriptDigest(script), version: REVIEW_VERSION, riskVersion: RISK_VERSION,
        method: 'lexical', findings: [...new Set(findings)], domains: [...domains].sort(),
        platforms: [...new Set(script.match(/\b(?:wy|kw|kg|tx|mg)\b/g) || [])].sort(),
        apis: [...new Set(script.match(/\b(?:musicUrl|request|inited|updateAlert|showConfigView)\b/g) || [])].sort(),
        limits: 'Text patterns only: comments/strings can cause false positives; aliases, computed properties, escapes, templates and remote code may evade detection. No AST, dataflow or safety proof.',
    };
}
function validateApproval(record, approval) {
    const report = reviewScript(record.script);
    if (record.digest !== report.digest || approval?.digest !== report.digest || approval?.reviewVersion !== report.version || approval?.riskVersion !== report.riskVersion || approval?.acknowledged !== true) throw new Error('LX: explicit current digest/review/risk approval required');
    return report;
}
module.exports = { reviewScript, validateApproval };
