# QQ Integration Plugin

This plugin integrates ASG.Director with QQ via LiteLoaderQQNT + LLOneBot.

## Setup

1. **Install LiteLoaderQQNT**: Run the command `qq.installLiteLoader` or visit [LiteLoaderQQNT](https://github.com/LiteLoaderQQNT/LiteLoaderQQNT).
2. **Install LLOneBot**: Install the LLOneBot plugin for LiteLoaderQQNT.
3. **Configure LLOneBot**: Enable HTTP API on port 5700.
4. **Configure Plugin**:
   - Create or edit `config.json` in this folder.
   - Set `groupId` to your target QQ Group ID.

## Config

```json
{
  "groupId": "123456789",
  "host": "127.0.0.1",
  "port": 5700
}
```
