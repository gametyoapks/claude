const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const BOT_TOKEN = process.env.BOT_TOKEN || 'HATA: BOT_TOKEN SET EDILMEDI';
const CLIENT_ID = process.env.CLIENT_ID || '1539304056173109399';
const GUILD_ID = process.env.GUILD_ID || '1530913629241606255';
const ROLE_ID = process.env.ROLE_ID || '1538161497929424996';
const VERIFY_SITE_URL = process.env.VERIFY_SITE_URL || 'https://toldclient.netlify.app';
const LOG_CHANNEL_ID = '1539306856865071225';

const SUPABASE_URL = 'https://ezgkggtbeqapynrsesxs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bt0PXWm2xIRKEv-vopP7Zg_sCzYH2e1';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

const commands = [
  {
    name: 'verify',
    description: 'Discord sunucusuna katılmak için doğrulama linkini göster'
  },
  {
    name: 'check',
    description: 'Bir kullanıcının doğrulama bilgisini kontrol et',
    options: [
      {
        name: 'user',
        description: 'Kontrol edilecek kullanıcı',
        type: 6,
        required: true
      }
    ]
  }
];

client.once('ready', async () => {
  console.log(`✅ Bot aktif: ${client.user.tag}`);
  
  try {
    console.log('📝 Komutlar kaydediliyor...');
    console.log('Guild ID:', GUILD_ID);
    console.log('Client ID:', CLIENT_ID);
    
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Komutlar başarıyla kaydedildi');
  } catch (error) {
    console.error('❌ Komut kayıt hatası:', error);
  }

  startVerificationPolling();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  console.log(`Komut alındı: ${interaction.commandName}`);

  try {
    if (interaction.commandName === 'verify') {
      const verifyEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🔐 ToldClient Doğrulama')
        .setDescription(`[Discord ile Doğrula](${VERIFY_SITE_URL})`)
        .addFields(
          { name: '✅ Güvenli Giriş', value: 'Discord hesabınız ile güvenli doğrulama yapın' },
          { name: '⚡ Hızlı İşlem', value: '30 saniyede sunucuya katılın' }
        )
        .setFooter({ text: 'Doğrulama sayfasında tüm adımları tamamlayın' });

      await interaction.reply({ embeds: [verifyEmbed], ephemeral: true });
    }

    if (interaction.commandName === 'check') {
      const targetUser = interaction.options.getUser('user');
      
      const checkEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📋 ${targetUser.username} Doğrulama Bilgisi`)
        .setDescription('Supabase veritabanından bilgiler alınıyor...')
        .setFooter({ text: 'Detaylı bilgi için sunucu yöneticisine sorabilirsiniz' });

      await interaction.reply({ embeds: [checkEmbed], ephemeral: true });
    }
  } catch (error) {
    console.error('❌ Komut hatası:', error);
  }
});

async function startVerificationPolling() {
  console.log('🔄 Doğrulama izlemesi başlatıldı...');
  
  setInterval(async () => {
    try {
      const { data: unverifiedUsers, error } = await supabase
        .from('verifications')
        .select('*')
        .eq('role_given', false)
        .order('verified_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('❌ Supabase sorgu hatası:', error);
        return;
      }

      if (!unverifiedUsers || unverifiedUsers.length === 0) {
        return;
      }

      const user = unverifiedUsers[0];
      await processVerification(user);

    } catch (error) {
      console.error('❌ Polling hatası:', error);
    }
  }, 5000);
}

async function processVerification(verificationData) {
  try {
    const { discord_id, username, email, email_status, ip_address, vpn_status } = verificationData;

    console.log(`📨 Yeni doğrulama bulundu: ${username} (${discord_id})`);

    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error('❌ Sunucu bulunamadı');
      return;
    }

    const member = await guild.members.fetch(discord_id).catch(() => null);
    if (!member) {
      console.log('⚠️ Üye sunucuda değil:', username);
      return;
    }

    await member.roles.add(ROLE_ID).catch(e => console.error('❌ Rol verme hatası:', e));
    console.log(`✅ Rol verildi: ${username}`);

    await member.send({
      embeds: [
        new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Sunucuya Hoşgeldiniz!')
          .setDescription(`Merhaba ${username}! Üye rolü başarıyla verildi.`)
          .addFields(
            { name: '📧 Email', value: email || 'Bilinmiyor' },
            { name: '🌐 IP', value: ip_address || 'Bilinmiyor' },
            { name: '🔒 VPN', value: vpn_status || 'Bilinmiyor' }
          )
      ]
    }).catch(() => console.log('⚠️ DM gönderilemedi:', username));

    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      const emailStatusText = email_status === 'SPAM' 
        ? '⚠️ SPAM EMAIL' 
        : (email_status === 'FREE' ? '📧 FREE EMAIL' : '✅ DOĞRULANDI');

      const logEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ DOĞRULAMA BAŞARILI')
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 Kullanıcı', value: `${username} (${member.user.tag})`, inline: true },
          { name: '🔑 Discord ID', value: `${discord_id}`, inline: true },
          { name: '📧 Email', value: email || 'Bilinmiyor', inline: true },
          { name: '📧 Durum', value: emailStatusText, inline: true },
          { name: '🌐 IP Adresi', value: ip_address || 'Bilinmiyor', inline: true },
          { name: '🔒 VPN', value: vpn_status || 'Bilinmiyor', inline: true },
          { name: '🕒 Zaman', value: new Date().toLocaleString('tr-TR'), inline: false }
        )
        .setFooter({ text: 'ToldClient Verification System' });

      await logChannel.send({ embeds: [logEmbed] }).catch(e => console.error('❌ Log mesajı hatası:', e));
      console.log(`✅ Log mesajı gönderildi: ${username}`);
    }

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

client.login(BOT_TOKEN);
      
