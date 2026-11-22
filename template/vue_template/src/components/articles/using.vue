<script lang="ts" setup>
import { onMounted, ref } from 'vue'

import articleView from './view.vue'

// name
defineOptions({
    name: 'custom-name'
})

const articleRef: any = ref(null)
const article = {
    "title": {
        "no": 1,
        "en": "How Artificial Intelligence Can Revolutionise Science",
        "zh": "人工智能如何能够给科学带来革命性的改变。",
        "words": [
            {
                "word": "Artificial Intelligence",
                "isPhrase": true,
                "matchs": [
                    "artificial",
                    "intelligence"
                ]
            },
            {
                "word": "Revolutionise",
                "isPhrase": false,
                "matchs": [
                    "revolutionise"
                ]
            }
        ]
    },
    "contents": [
        {
            "sentences": [
                {
                    "no": 2,
                    "en": "Debate about artificial intelligence tends to focus on its potential dangers:",
                    "zh": "有关人工智能的辩论通常倾向于聚焦在它的潜在危害上。",
                    "words": [
                        {
                            "word": "Debate",
                            "isPhrase": false,
                            "matchs": [
                                "debate"
                            ]
                        },
                        {
                            "word": "potential",
                            "isPhrase": false,
                            "matchs": [
                                "potential"
                            ]
                        }
                    ]
                },
                {
                    "no": 3,
                    "en": "algorithmic bias and discrimination, the mass destruction of jobs and even, some say, the extinction of humanity.",
                    "zh": "算法偏见与歧视、大规模摧毁岗位，甚至还有一些人提到的人类灭亡。",
                    "words": [
                        {
                            "word": "algorithmic",
                            "isPhrase": false,
                            "matchs": [
                                "algorithmic"
                            ]
                        },
                        {
                            "word": "bias",
                            "isPhrase": false,
                            "matchs": [
                                "bias"
                            ]
                        },
                        {
                            "word": "discrimination",
                            "isPhrase": false,
                            "matchs": [
                                "discrimination"
                            ]
                        },
                        {
                            "word": "destruction",
                            "isPhrase": false,
                            "matchs": [
                                "destruction"
                            ]
                        },
                        {
                            "word": "extinction",
                            "isPhrase": false,
                            "matchs": [
                                "extinction"
                            ]
                        },
                        {
                            "word": "humanity",
                            "isPhrase": false,
                            "matchs": [
                                "humanity"
                            ]
                        }
                    ]
                },
                {
                    "no": 4,
                    "en": "As some observers fret about these dystopian scewnarios, however, others are focusing on potential rewards.",
                    "zh": "不过，在一些评论家位这些反乌托邦情境烦恼的同时，其他人关注的则是其潜在的回报。",
                    "words": [
                        {
                            "word": "observers",
                            "isPhrase": false,
                            "matchs": [
                                "observer"
                            ]
                        },
                        {
                            "word": "fret",
                            "isPhrase": false,
                            "matchs": [
                                "fret"
                            ]
                        },
                        {
                            "word": "dystopian",
                            "isPhrase": false,
                            "matchs": [
                                "dystopian"
                            ]
                        }
                    ]
                },
                {
                    "no": 5,
                    "en": "AI could, they claim, help humanity solve some of its biggest and thorniest problems.",
                    "zh": "他们称人工智能可以帮助人类解决一些最大、最棘手的问题。",
                    "words": [
                        {
                            "word": "thorniest",
                            "isPhrase": false,
                            "matchs": [
                                "thorny"
                            ]
                        }
                    ]
                },
                {
                    "no": 6,
                    "en": "And, they say, AI will do this in a very specific way:",
                    "zh": "他们还说，人工智能将以一种非常独特的方式做到这一点：",
                    "words": []
                },
                {
                    "no": 7,
                    "en": "by radically accelerating the pace of scientific discovery, especially in areas such as medicine, climate science and green technology.",
                    "zh": "大幅加快科学发现的步伐，尤其是在医学、气候科学以及绿色技术等领域。",
                    "words": [
                        {
                            "word": "radically",
                            "isPhrase": false,
                            "matchs": [
                                "radically"
                            ]
                        },
                        {
                            "word": "accelerating",
                            "isPhrase": false,
                            "matchs": [
                                "accelerate"
                            ]
                        },
                        {
                            "word": "medicine",
                            "isPhrase": false,
                            "matchs": [
                                "medicine"
                            ]
                        }
                    ]
                },
                {
                    "no": 8,
                    "en": "Luminaries in the field such as Demis Hassabis and Yann LeCun believe that AI can turbocharge scientific progress and lead to a golden age of discovery.",
                    "zh": "领域内的杰出人物-诸如德米耶·哈萨比斯以及扬·莱坎（杨立昆）等-都认为，人工智能可以大大推动科研进展，并开启科学发现的黄金时代，",
                    "words": [
                        {
                            "word": "Luminaries",
                            "isPhrase": false,
                            "matchs": [
                                "luminary"
                            ]
                        },
                        {
                            "word": "turbocharge",
                            "isPhrase": false,
                            "matchs": [
                                "turbocharge"
                            ]
                        }
                    ]
                },
                {
                    "no": 9,
                    "en": "Could they be right?",
                    "zh": "他们会是正确的吗？",
                    "words": []
                }
            ]
        },
        {
            "sentences": [
                {
                    "no": 10,
                    "en": "Such claims are worth examining, and may provide a useful counterbalance to fears about large-scale unemployment and killer robots.",
                    "zh": "这类说法值得思考，并且或许能提供一种有用的论点来调节对大规模失业和杀手机器人的恐惧。",
                    "words": [
                        {
                            "word": "counterbalance",
                            "isPhrase": false,
                            "matchs": [
                                "counterbalance"
                            ]
                        }
                    ]
                },
                {
                    "no": 11,
                    "en": "Many previous technologies have, of course, been falsely hailed as panaceas.",
                    "zh": "当然，以前有许多技术曾被错误地称颂为灵丹妙药。",
                    "words": [
                        {
                            "word": "hailed",
                            "isPhrase": false,
                            "matchs": [
                                "hail"
                            ]
                        },
                        {
                            "word": "panaceas",
                            "isPhrase": false,
                            "matchs": [
                                "panacea"
                            ]
                        }
                    ]
                },
                {
                    "no": 12,
                    "en": "The electric telegraph was lauded in the 1850s as a herald of world peace, as were aircraft in the 1900s;",
                    "zh": "电报技术曾在19世纪50年代被称赞为世界和平的使者，飞机在20世纪头十年也受到同样的赞誉；",
                    "words": [
                        {
                            "word": "telegraph",
                            "isPhrase": false,
                            "matchs": [
                                "telegraph"
                            ]
                        },
                        {
                            "word": "lauded",
                            "isPhrase": false,
                            "matchs": [
                                "laud"
                            ]
                        },
                        {
                            "word": "herald",
                            "isPhrase": false,
                            "matchs": [
                                "herald"
                            ]
                        }
                    ]
                },
                {
                    "no": 13,
                    "en": "pundits in the 1990s said the internet would reduce inequality and eradicate nationalism.",
                    "zh": "20世纪90年代，专家曾说，互联网将减少不平等，消除民族主义。",
                    "words": [
                        {
                            "word": "pundits",
                            "isPhrase": false,
                            "matchs": [
                                "pundit"
                            ]
                        },
                        {
                            "word": "eradicate",
                            "isPhrase": false,
                            "matchs": [
                                "eradicate"
                            ]
                        },
                        {
                            "word": "nationalism",
                            "isPhrase": false,
                            "matchs": [
                                "nationalism"
                            ]
                        }
                    ]
                },
                {
                    "no": 15,
                    "en": "But the mechanism by which AI will supposedly solve the world's problems has a stronger historical basis, because there have been several periods in the history when new approaches and new tools did indeed help bring about bursts of world-changing sciectific discovery and innovation.",
                    "zh": "但是，人们认为人工智能能够用来解决世界问题的机制有着更强的历史基础，因为在历史上的多个阶段，新方法与新工具都的确带来了足以改变世界的科学发现与创新的迸发。",
                    "words": [
                        {
                            "word": "supposedly",
                            "isPhrase": false,
                            "matchs": [
                                "supposedly"
                            ]
                        },
                        {
                            "word": "approaches",
                            "isPhrase": false,
                            "matchs": [
                                "approache"
                            ]
                        },
                        {
                            "word": "bring about",
                            "isPhrase": true,
                            "matchs": [
                                "bring"
                            ]
                        },
                        {
                            "word": "bursts",
                            "isPhrase": false,
                            "matchs": [
                                "burst"
                            ]
                        }
                    ]
                }
            ]
        },
    ]
}

onMounted(() => { })
</script>

<template>
    <div class="sections">
        <articleView ref="articleRef" :article="article"></articleView>
        <button @click="articleRef.toggleZH">click</button>
    </div>
</template>

<style scoped lang="scss"></style>
