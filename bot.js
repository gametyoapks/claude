const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, Collection } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// Config
const BOT_TOKEN = process.env.BOT_TOKEN || 'BOT_TOKEN';
const CLIENT_ID = process.env.CLIENT_ID || '1539304056173109399';
const GUILD_ID = process.env.GUILD_ID || '1530913629241606255';
const ROLE_ID = process.env.ROLE_ID || '1538161497929424996';
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || '1539306856865071225';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ezgkggtbeqapynrsesxs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_bt0PXWm2xIRKEv-vopP7Zg_sCzYH2e1';
const VERIFY_SITE_URL = process.env.VERIFY_SITE_URL || 'https://toldclient.netlify.app';

// Initialize
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🚀 ToldClient Bot başlatılıyor...');

// Event: Ready
client.once('ready', async () => {
  console.log(`✅ Bot giriş yaptı: ${client.user.tag}`);

  try {
    const commands = [
      {
        name: 'verify',
        description: 'Doğrulama sayfasına giderek üye olmayı başlat'
      },
      {
        name: 'check',
        description: 'Kullanıcının doğrulama durumunu kontrol et',
        options: [
          {
            name: 'user',
            description: 'Kontrol edilecek kullanıcı',
            type: 6,
            required: true
          }
        ]
      },
      {
        name: 'manual-verify',
        description: 'Manual doğrulama (ADMIN ONLY)',
        options: [
          {
            name: 'user',
            description: 'Doğrulanacak kullanıcı',
            type: 6,
            required: true
          }
        ]
      }
    ];

    const rest = new REST().setToken(BOT_TOKEN);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Komutlar kaydedildi');
  } catch (error) {
    console.error('❌ Komut kayıt hatası:', error);
  }

  startVerificationPolling();
});

// Event: Interaction (Commands)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  console.log(`📨 Komut: ${interaction.commandName} | Kullanıcı: ${interaction.user.tag}`);

  try {
    if (interaction.commandName === 'verify') {
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🔐 ToldClient Doğrulama')
        .setDescription(`[Doğrulama sayfasına git →](${VERIFY_SITE_URL})`)
        .addFields(
          { name: '✅ Güvenli', value: 'Discord OAuth ile' },
          { name: '⚡ Hızlı', value: '30 saniyede tamamlanır' }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      console.log(`✅ /verify komutu çalıştırıldı: ${interaction.user.username}`);
    }

    if (interaction.commandName === 'check') {
      const targetUser = interaction.options.getUser('user');

      try {
        const { data, error } = await supabase
          .from('verifications')
          .select('*')
          .eq('discord_id', targetUser.id)
          .single();

        if (error || !data) {
          const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle(`❌ ${targetUser.username} Doğrulanmamış`)
            .setDescription('Bu kullanıcı henüz doğrulama yapmamış');

          await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
          return;
        }

        const resultEmbed = new EmbedBuilder()
          .setColor(data.role_given ? '#00FF00' : '#FF9900')
          .setTitle(`${data.role_given ? '✅' : '⏳'} ${targetUser.username}`)
          .addFields(
            { name: '📧 Email', value: data.email || 'Yok', inline: true },
            { name: '📅 Doğrulanma Tarihi', value: data.verified_at ? new Date(data.verified_at).toLocaleString('tr-TR') : 'Bilinmiyor', inline: true },
            { name: '🔒 Rol Verildi', value: data.role_given ? 'Evet' : 'Hayır', inline: true }
          );

        await interaction.reply({ embeds: [resultEmbed], ephemeral: true });
      } catch (error) {
        console.error('❌ Check hatası:', error);
        await interaction.reply({ content: '❌ Sorgu başarısız: ' + error.message, ephemeral: true });
      }
    }

    if (interaction.commandName === 'manual-verify') {
      // Admin check
      if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        await interaction.reply({ content: '❌ Bu komut sadece yöneticiler tarafından kullanılabilir', ephemeral: true });
        return;
      }

      const targetUser = interaction.options.getUser('user');
      const guild = client.guilds.cache.get(GUILD_ID);

      if (!guild) {
        await interaction.reply({ content: '❌ Sunucu bulunamadı', ephemeral: true });
        return;
      }

      try {
        const member = await guild.members.fetch(targetUser.id);
        
        // Rol ver
        await member.roles.add(ROLE_ID);
        console.log(`✅ Manual rol verildi: ${targetUser.username}`);

        // Supabase'e kayıt et
        const { error } = await supabase
          .from('verifications')
          .insert([{
            discord_id: parseInt(targetUser.id),
            username: targetUser.username,
            account_created_at: new Date().toISOString(),
            ip_address: '0.0.0.0',
            vpn_status: 'Bilinmiyor',
            email: 'manual-verify',
            email_status: 'MANUAL',
            role_given: true
          }]);

        if (error) console.error('❌ Supabase insert hatası:', error);

        // DM gönder
        await targetUser.send({
          embeds: [
            new EmbedBuilder()
              .setColor('#00FF00')
              .setTitle('✅ Sunucuya Hoşgeldiniz!')
              .setDescription('Yönetici tarafından rol verildi')
          ]
        }).catch(() => console.log('⚠️ DM gönderilemedi'));

        // Log
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
          await logChannel.send({
            embeds: [
              new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('⚠️ MANUEL DOĞRULAMA')
                .setDescription(`${targetUser.username} (${targetUser.id})`)
                .setFooter({ text: 'Yönetici tarafından verildi' })
            ]
          });
        }

        await interaction.reply({ content: `✅ ${targetUser.username} için rol verildi`, ephemeral: true });

      } catch (error) {
        console.error('❌ Manual verify hatası:', error);
        await interaction.reply({ content: '❌ Başarısız: ' + error.message, ephemeral: true });
      }
    }

  } catch (error) {
    console.error('❌ İnteraksiyon hatası:', error);
    try {
      await interaction.reply({ content: '❌ Hata oluştu: ' + error.message, ephemeral: true });
    } catch (e) {
      console.error('❌ Reply gönderme hatası:', e);
    }
  }
});

// Polling: Supabase'dan doğrulama kontrol
async function startVerificationPolling() {
  console.log('🔄 Doğrulama polling başlatıldı (5sn arası)');

  setInterval(async () => {
    try {
      const { data: pendingUsers, error } = await supabase
        .from('verifications')
        .select('*')
        .eq('role_given', false)
        .order('verified_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('❌ Supabase query hatası:', error);
        return;
      }

      if (!pendingUsers || pendingUsers.length === 0) return;

      console.log(`📊 Pending kullanıcılar: ${pendingUsers.length}`);

      for (const user of pendingUsers) {
        await processVerification(user);
      }

    } catch (error) {
      console.error('❌ Polling hatası:', error);
    }
  }, 5000);
}

async function processVerification(verificationData) {
  try {
    const { discord_id, username, email, email_status, ip_address, vpn_status } = verificationData;

    console.log(`🎯 İşleniyor: ${username} (${discord_id})`);

    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error('❌ Sunucu bulunamadı');
      return;
    }

    const member = await guild.members.fetch(discord_id).catch(() => null);
    if (!member) {
      console.log(`⚠️ Üye sunucuda değil: ${username}`);
      return;
    }

    // Rol ver
    await member.roles.add(ROLE_ID).catch(e => console.error('❌ Rol verme hatası:', e));
    console.log(`✅ Rol verildi: ${username}`);

    // DM gönder
    try {
      await member.send({
        embeds: [
          new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Sunucuya Hoşgeldiniz!')
            .setDescription(`Merhaba ${username}!`)
            .addFields(
              { name: '📧 Email', value: email || 'Yok' },
              { name: '🌐 IP', value: ip_address || 'Yok' },
              { name: '🔒 VPN', value: vpn_status || 'Yok' }
            )
        ]
      });
    } catch (e) {
      console.log(`⚠️ DM gönderilemedi: ${username}`);
    }

    // Log kanalı
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      const emailBadge = email_status === 'SPAM' ? '⚠️ SPAM' : (email_status === 'FREE' ? '📧 FREE' : '✅ VERIFIED');

      await logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ DOĞRULAMA BAŞARILI')
            .addFields(
              { name: '👤 Kullanıcı', value: `${username} (${member.user.tag})`, inline: true },
              { name: '🔑 ID', value: `${discord_id}`, inline: true },
              { name: '📧 Email', value: emailBadge, inline: true }
            )
        ]
      });
    }

    // DB update
    const { error: updateError } = await supabase
      .from('verifications')
      .update({ role_given: true })
      .eq('discord_id', discord_id);

    if (updateError) {
      console.error('❌ DB güncellemesi hatası:', updateError);
    } else {
      console.log(`✅ DB güncellendi: ${username}`);
    }

  } catch (error) {
    console.error('❌ Doğrulama işleme hatası:', error);
  }
}

// Login
client.login(BOT_TOKEN);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('👋 Bot kapatılıyor...');
  client.destroy();
  process.exit(0);
});
