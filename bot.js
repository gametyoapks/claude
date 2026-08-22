const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const ROLE_ID = process.env.ROLE_ID;
const LOG_CHANNEL_ID = '1539306856865071225';

const SUPABASE_URL = 'https://ezgkggtbeqapynrsesxs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bt0PXWm2xIRKEv-vopP7Zg_sCzYH2e1';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages]
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Bot hazır → Polling başlat
client.once('ready', () => {
  console.log(`✅ Bot aktif: ${client.user.tag}`);
  startVerificationPolling(); // Her 5 saniyede kontrol et
});

// Her 5 saniyede Supabase'i kontrol et
async function startVerificationPolling() {
  setInterval(async () => {
    const { data: users } = await supabase
      .from('verifications')
      .select('*')
      .eq('role_given', false)
      .limit(1);

    if (users?.length > 0) {
      await processVerification(users[0]);
    }
  }, 5000);
}

// Yeni doğrulama bulundu → ROL VER + LOG + DM
async function processVerification(user) {
  const { discord_id, username, email, email_status, ip_address, vpn_status } = user;
  
  const guild = client.guilds.cache.get(GUILD_ID);
  const member = await guild.members.fetch(discord_id).catch(() => null);

  if (!member) return;

  // ROL VER
  await member.roles.add(ROLE_ID);

  // DM GÖNDER
  await member.send({
    embeds: [{
      color: 0x00FF00,
      title: '✅ Sunucuya Hoşgeldiniz!',
      fields: [
        { name: '📧 Email', value: email },
        { name: '🌐 IP', value: ip_address },
        { name: '🔒 VPN', value: vpn_status }
      ]
    }]
  }).catch(() => {});

  // LOG KANALINAğA GÖNDER
  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  await logChannel.send({
    embeds: [{
      color: 0x00FF00,
      title: '✅ DOĞRULAMA BAŞARILI',
      fields: [
        { name: '👤 Kullanıcı', value: username, inline: true },
        { name: '🔑 ID', value: discord_id, inline: true },
        { name: '📧 Email', value: email, inline: true },
        { name: '🌐 IP', value: ip_address, inline: true }
      ]
    }]
  });

  // Supabase'te işaretle
  await supabase.from('verifications').update({ role_given: true }).eq('discord_id', discord_id);
}

client.login(BOT_TOKEN);
