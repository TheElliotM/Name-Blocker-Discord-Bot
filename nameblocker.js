const Discord = require("discord.js")
const Token = require("./token.json")
const client = new Discord.Client();
const mysql = require('mysql2');
const Buttons = require('discord-buttons')(client)
const { MessageButton, MessageActionRow } = require('discord-buttons');

const pool = mysql.createPool(Token.mysql_auth);

client.on('guildMemberAdd', async member => {

    pool.query("SELECT name, contains FROM nameblocker.blocked_list WHERE `guild_id` = ?", [member.guild.id], async (err, rows) => {
        if (err || rows.length === 0) return

        for (let r in rows) {
            const entry = rows[r]
            let shouldBan = false
            if (Number(entry.contains) === 1)
                shouldBan = member.user.username.toLowerCase().includes(entry.name.toLowerCase())
            else
                shouldBan = member.user.username.toLowerCase() === entry.name.toLowerCase()
            if (shouldBan === true) {
                await member.guild.systemChannel.send(`🔨 ${member.user.tag} got the ban hammer!`)
                await member.ban()
                break
            }
        }

    })

})

client.on('message', async msg => {
    if (msg.author.bot || msg.channel.type === "dm") return;
    if (!msg.channel.permissionsFor(msg.author.id).has("ADMINISTRATOR")) return

    const m = msg.cleanContent.toLowerCase()

    if (m === "nb!add") {
        addWizard(msg)
    } else if (m.split(" ")[0] === "nb!delete") {
        if (m.split(" ").length > 1 && !isNaN(m.split(" ")[1]))
            deleteWizard(msg, m.split(" ")[1])
        else
            msg.channel.send("You must be the numerical id of the name you want to delete after the command. Usage: `nb!delete <id>`.\nTo find these IDs, run `nb!list`.")

    } else if (m === "nb!list") {

        pool.query("SELECT id, name, contains FROM nameblocker.blocked_list WHERE `guild_id` = ?", [msg.guild.id], async (err, rows) => {
            if (err || rows.length === 0) return msg.channel.send("❌ No results")

            const embed = new Discord.MessageEmbed()
                .setColor('RANDOM')
                .setAuthor(`Name Block List`)
                .setDescription(`A list of every name blocked, their ID, and if they are set to have it where a username can *contain* it instead of being exactly equal.`);

            for (let r in rows) {
                const entry = rows[r]
                embed.addField(`ID: **${entry.id}**`, `Name: ${entry.name}\nContains: ${Number(entry.contains) === 1 ? "true" : "false"}`, true)
            }

            msg.channel.send(embed)
        })

    } else if (m.startsWith("nb!")) {
        msg.channel.send("Commands: `nb!add`, `nb!list`, `nb!delete <id>`")
    }

})

async function addWizard(msg) {

    let name, contains

    let yesButton = new MessageButton()
        .setLabel("It Should Contain It")
        .setStyle("blurple")
        .setID("contain")

    let noButton = new MessageButton()
        .setLabel("It Should Equal It")
        .setStyle("blurple")
        .setID("equal")

    let buttonRow = new MessageActionRow()
        .addComponent(yesButton)
        .addComponent(noButton)

    let m = await msg.channel.send("1️⃣ First, is this banned username only supposed to be part of the name? Or is it the entire name?", { component: buttonRow })

    const filter = (button) => button.clicker.user.id === msg.author.id && (button.id === "contain" || button.id === "equal");
    const collector = m.createButtonCollector(filter, { time: 60000 });

    collector.on('collect', async b => {
        collector.stop();
        contains = b.id === "contain"
        await m.edit(`✅ Alright, it should \`${contains ? "contain" : "equal"}\` it.`)
        m = await msg.channel.send("What should the banned name be? Case is ignored.")

        const mCollector = msg.channel.createMessageCollector(ml => ml.author.id === msg.author.id, { time: 600000 })
        mCollector.on('collect', async (c) => {
            mCollector.stop()
            name = c.cleanContent.toLowerCase()

            await m.edit(`✅ Alright, the banned name is \`${name}\``)
            m = await msg.channel.send("🔄 Saving")

            pool.query("INSERT INTO `nameblocker`.`blocked_list` (`guild_id`, `name`, `contains`) VALUES (?, ?, ?)",
                [msg.guild.id, name, contains], async (err, rows) => {
                    if (err) m.edit("❌ An error occurred.")
                    else m.edit("😀 Uploaded!")
                })

        })
    })

}

async function deleteWizard(msg, arg) {
    let yesButton = new MessageButton()
        .setLabel("Delete It")
        .setStyle("red")
        .setID("deleteYes")

    let noButton = new MessageButton()
        .setLabel("Nevermind")
        .setStyle("green")
        .setID("deleteNo")

    let buttonRow = new MessageActionRow()
        .addComponent(yesButton)
        .addComponent(noButton)

    let m = await msg.channel.send(`(╯°□°）╯︵ ┻━┻\nAre you sure you want to delete the blocked name with id ${arg}?`, { component: buttonRow })

    const filter = (button) => button.clicker.user.id === msg.author.id && (button.id === "deleteYes" || button.id === "deleteNo");
    const collector = m.createButtonCollector(filter, { time: 60000 });

    collector.on('collect', async b => {
        responded = true;
        collector.stop();
        if (b.id === "deleteYes") {
            pool.query(`DELETE FROM nameblocker.blocked_list WHERE id = ? AND guild_id = ?`,
                [arg, msg.guild.id], async (err, rows) => {
                    if (err) m.edit("❌ An error occurred.")
                    else m.edit("✅ If that ID existed, it's associated blocked name is gone.")
                })
        } else {
            await m.edit("┳━┳ ノ( ゜-゜ノ) Alright, not deleting anything.")
        }
    })
}

client.on('ready', () => {
    console.log(`Bot ready!`)
    client.user.setActivity('names > nb!', { type: 'WATCHING' })
})

client.login(Token.token)