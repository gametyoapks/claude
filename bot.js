const { Client, IntentFlags, REST, Routes, EmbedBuilder } = require('discord.js');

// Konfigürasyon
const BOT_TOKEN = process.env.BOT_TOKEN || 'MTUzOTMwNDA1NjE3MzEwOTM5OQ.GuBBvV.8QtfE0CGbvz-swt-lSb2IzNzBefHYMoOQ_VNUg';
const CLIENT_ID = process.env.CLIENT_ID || '1539304056173109399';
const GUILD_ID = process.env.GUILD_ID || '1530913629241606255';
const ROLE_ID = process.env.ROLE_ID || '1538161497929424996';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ezgkggtbeqapynrsesxs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_bt0PXWm2xIRKEv-vopP7Zg_sCzYH2e1';
const VERIFY_SITE_URL = process.env.VERIFY_SITE_URL || 'https://toldclient.netlify.app';

// Client oluştur
const client = new Client({
  intents: [
    IntentFlags.Guilds,
    IntentFlags.GuildMembers,
    IntentFlags.DirectMessages,
  ],
});

// Bot hazır
client.on('ready', () => {
  console.log(`✅ Bot hazır: ${client.user.tag}`);
  client.user.setActivity('Doğrulama Sistemi', { type: 'WATCHING' });

  // Slash command'ları kaydet
  registerCommands();
});

// Slash command'ları kaydet
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

  const commands = [
    {
      name: 'verify',
      description: 'Doğrulama linkini gönder',
    },
    {
      name: 'check',
      description: 'Bir kullanıcının doğrulama durumunu kontrol et',
      options: [
        {
          name: 'user',
          description: 'Kontrol edilecek kullanıcı',
          type: 6,
          required: true,
        },
      ],
    },
  ];

  try {
    console.log('⚙️ Slash command\'ları kaydediliyor...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log('✅ Slash command\'ları kaydedildi');
  } catch (error) {
    console.error('❌ Command kayıt hatası:', error);
  }
}

// Komutları işle
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'verify') {
      await handleVerifyCommand(interaction);
    } else if (interaction.commandName === 'check') {
      await handleCheckCommand(interaction);
    }
  } catch (error) {
    console.error('❌ Command hatası:', error);
    await interaction.reply({
      content: '❌ Komut işlenirken hata oluştu',
      ephemeral: true,
    });
  }
});

// /verify komutu
async function handleVerifyCommand(interaction) {
  const verifyUrl = VERIFY_SITE_URL;

  const embed = new EmbedBuilder()
    .setColor('#667eea')
    .setTitle('🔐 Discord Doğrulaması')
    .setDescription('Sunucuya katılmak için aşağıdaki linke tıklayın')
    .addFields(
      {
        name: '📋 Doğrulama Adımları',
        value: '1. Linke tıklayın\n2. Discord ile giriş yapın\n3. Doğrulama tamamlanır\n4. Rol otomatik verilir',
      },
      {
        name: '🔒 Güvenlik',
        value: 'IP adresi ve VPN durumunuz kontrol edilecektir',
      }
    )
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            label: 'Doğrulamaya Git',
            style: 5,
            url: verifyUrl,
          },
        ],
      },
    ],
    ephemeral: true,
  });
}

// /check komutu
async function handleCheckCommand(interaction) {
  const user = interaction.options.getUser('user');

  await interaction.deferReply({ ephemeral: true });

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/verifications?discord_id=eq.${user.id}`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          apikey: SUPABASE_KEY,
        },
      }
    );

    const data = await response.json();

    if (!data || data.length === 0) {
      return await interaction.editReply({
        content: `❌ ${user.username} doğrulama yapmamış`,
      });
    }

    const verification = data[0];
    const verifiedDate = new Date(verification.verified_at).toLocaleDateString(
      'tr-TR'
    );
    const accountDate = new Date(
      verification.account_created_at
    ).toLocaleDateString('tr-TR');

    const embed = new EmbedBuilder()
      .setColor('#28a745')
      .setTitle('✅ Doğrulama Bilgisi')
      .addFields(
        { name: 'Kullanıcı', value: user.username, inline: true },
        { name: 'Discord ID', value: user.id, inline: true },
        {
          name: 'Doğrulama Tarihi',
          value: verifiedDate,
          inline: true,
        },
        {
          name: 'Hesap Oluş. Tarihi',
          value: accountDate,
          inline: true,
        },
        { name: 'IP Adresi', value: verification.ip_address, inline: true },
        {
          name: 'VPN Durumu',
          value: verification.vpn_status === 'Evet' ? '🚩 Evet' : '✅ Hayır',
          inline: true,
        },
        {
          name: 'Rol Verildi',
          value: verification.role_given ? '✅ Evet' : '❌ Hayır',
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Kontrol hatası:', error);
    await interaction.editReply({
      content: '❌ Kontrol sırasında hata oluştu',
    });
  }
}

// Yeni üye katıldığında kontrol et
client.on('guildMemberAdd', async (member) => {
  console.log(`👤 Yeni üye: ${member.user.tag}`);

  try {
    await new Promise((r) => setTimeout(r, 5000));

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/verifications?discord_id=eq.${member.id}`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          apikey: SUPABASE_KEY,
        },
      }
    );

    const data = await response.json();

    if (!data || data.length === 0) {
      console.log(`❌ ${member.user.tag} doğrulama yapmamış`);
      return;
    }

    const verification = data[0];

    await member.roles.add(ROLE_ID);
    console.log(`✅ ${member.user.tag} rolü verildi`);

    await fetch(`${SUPABASE_URL}/rest/v1/verifications?discord_id=eq.${member.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify({ role_given: true }),
    });

    try {
      const embed = new EmbedBuilder()
        .setColor('#28a745')
        .setTitle('✅ Doğrulama Başarılı!')
        .setDescription(
          'Sunucuya katılmaya onay verildı. Üye rolü verildi.'
        )
        .addFields(
          {
            name: '👤 Hesap Bilgileri',
            value: `**Kullanıcı:** ${member.user.username}\n**ID:** ${member.id}`,
          },
          {
            name: '🔍 Kontrol Bilgileri',
            value: `**IP:** ${verification.ip_address}\n**VPN:** ${verification.vpn_status}`,
          },
          {
            name: '📅 Doğrulama Tarihi',
            value: new Date(verification.verified_at).toLocaleDateString('tr-TR'),
          }
        )
        .setFooter({ text: 'ToldClient Doğrulama Sistemi' })
        .setTimestamp();

      await member.send({ embeds: [embed] });
      console.log(`📧 ${member.user.tag} e DM gönderildi`);
    } catch (dmError) {
      console.log(`⚠️ ${member.user.tag} e DM gönderilemedi`);
    }
  } catch (error) {
    console.error(`❌ Hata (${member.user.tag}):`, error);
  }
});

client.login(BOT_TOKEN);

process.on('SIGINT', () => {
  console.log('🛑 Bot kapatılıyor...');
  client.destroy();
  process.exit(0);
});
