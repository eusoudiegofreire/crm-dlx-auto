export type ConversationStatus = "open" | "waiting" | "resolved";
export type MessageSender = "contact" | "hermes" | "agent";
export type MessageDirection = "inbound" | "outbound";

export interface MockConversation {
  id: string;
  contactName: string;
  contactPhone: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  lastMessageSender: MessageSender;
  unreadCount: number;
  status: ConversationStatus;
  hermesActive: boolean;
}

export interface MockMessage {
  id: string;
  conversationId: string;
  sender: MessageSender;
  direction: MessageDirection;
  content: string;
  createdAt: string;
}

export const MOCK_CONVERSATIONS: MockConversation[] = [
  {
    id: "conv-1",
    contactName: "Ana Lima",
    contactPhone: "+55 69 99999-1234",
    lastMessagePreview: "Quero agendar uma consulta para segunda",
    lastMessageAt: "14:32",
    lastMessageSender: "contact",
    unreadCount: 3,
    status: "open",
    hermesActive: true,
  },
  {
    id: "conv-2",
    contactName: "Carlos Silva",
    contactPhone: "+55 69 98888-5678",
    lastMessagePreview: "Perfeito! Vou confirmar e já te aviso",
    lastMessageAt: "13:15",
    lastMessageSender: "hermes",
    unreadCount: 0,
    status: "open",
    hermesActive: true,
  },
  {
    id: "conv-3",
    contactName: "Fernanda Melo",
    contactPhone: "+55 69 97777-9012",
    lastMessagePreview: "Oi, tudo bem? Preciso remarcar minha consulta",
    lastMessageAt: "Ontem",
    lastMessageSender: "contact",
    unreadCount: 1,
    status: "waiting",
    hermesActive: false,
  },
  {
    id: "conv-4",
    contactName: "Roberto Costa",
    contactPhone: "+55 69 96666-3456",
    lastMessagePreview: "Ok, muito obrigado pelo atendimento!",
    lastMessageAt: "Seg",
    lastMessageSender: "contact",
    unreadCount: 0,
    status: "resolved",
    hermesActive: false,
  },
  {
    id: "conv-5",
    contactName: "Juliana Ferreira",
    contactPhone: "+55 69 95555-7890",
    lastMessagePreview: "Qual o valor da consulta de avaliação?",
    lastMessageAt: "14:01",
    lastMessageSender: "contact",
    unreadCount: 2,
    status: "open",
    hermesActive: true,
  },
  {
    id: "conv-6",
    contactName: "Marcos Oliveira",
    contactPhone: "+55 69 94444-2345",
    lastMessagePreview: "Pode ser na sexta de manhã",
    lastMessageAt: "11:48",
    lastMessageSender: "contact",
    unreadCount: 0,
    status: "waiting",
    hermesActive: false,
  },
];

export const MOCK_MESSAGES: MockMessage[] = [
  // conv-1: Ana Lima
  {
    id: "msg-1-1",
    conversationId: "conv-1",
    sender: "contact",
    direction: "inbound",
    content: "Olá! Bom dia! Vi o anúncio de vocês no Instagram e fiquei interessada",
    createdAt: "14:10",
  },
  {
    id: "msg-1-2",
    conversationId: "conv-1",
    sender: "hermes",
    direction: "outbound",
    content:
      "Olá, Ana! Bom dia! 😊 Seja bem-vinda à Sorrir Odontologia. Que ótimo que você nos encontrou! Como posso te ajudar hoje?",
    createdAt: "14:10",
  },
  {
    id: "msg-1-3",
    conversationId: "conv-1",
    sender: "contact",
    direction: "inbound",
    content: "Quero agendar uma consulta para segunda",
    createdAt: "14:32",
  },

  // conv-2: Carlos Silva
  {
    id: "msg-2-1",
    conversationId: "conv-2",
    sender: "contact",
    direction: "inbound",
    content: "Olá, tudo bem? Queria saber sobre tratamento de canal, vocês fazem?",
    createdAt: "12:40",
  },
  {
    id: "msg-2-2",
    conversationId: "conv-2",
    sender: "hermes",
    direction: "outbound",
    content:
      "Olá, Carlos! Sim, realizamos tratamentos de canal aqui na Sorrir. Temos dentistas especialistas em endodontia. Posso te passar mais detalhes sobre o procedimento?",
    createdAt: "12:41",
  },
  {
    id: "msg-2-3",
    conversationId: "conv-2",
    sender: "contact",
    direction: "inbound",
    content: "Ótimo! Qual seria o custo aproximado?",
    createdAt: "12:55",
  },
  {
    id: "msg-2-4",
    conversationId: "conv-2",
    sender: "hermes",
    direction: "outbound",
    content:
      "O valor varia conforme o dente e a complexidade do caso. Para te dar um valor preciso, precisamos de uma avaliação presencial. Posso agendar uma avaliação gratuita para você?",
    createdAt: "12:56",
  },
  {
    id: "msg-2-5",
    conversationId: "conv-2",
    sender: "contact",
    direction: "inbound",
    content: "Sim, pode marcar para quinta-feira à tarde",
    createdAt: "13:10",
  },
  {
    id: "msg-2-6",
    conversationId: "conv-2",
    sender: "hermes",
    direction: "outbound",
    content: "Perfeito! Vou confirmar e já te aviso",
    createdAt: "13:15",
  },

  // conv-3: Fernanda Melo
  {
    id: "msg-3-1",
    conversationId: "conv-3",
    sender: "contact",
    direction: "inbound",
    content: "Oi, tudo bem? Preciso remarcar minha consulta",
    createdAt: "Ontem 16:22",
  },

  // conv-4: Roberto Costa
  {
    id: "msg-4-1",
    conversationId: "conv-4",
    sender: "hermes",
    direction: "outbound",
    content: "Olá Roberto! Seu atendimento foi confirmado para amanhã às 10h. Nos vemos em breve! 😊",
    createdAt: "Seg 09:15",
  },
  {
    id: "msg-4-2",
    conversationId: "conv-4",
    sender: "contact",
    direction: "inbound",
    content: "Ok, muito obrigado pelo atendimento!",
    createdAt: "Seg 10:30",
  },

  // conv-5: Juliana Ferreira
  {
    id: "msg-5-1",
    conversationId: "conv-5",
    sender: "contact",
    direction: "inbound",
    content: "Boa tarde! Gostaria de saber os valores dos tratamentos de vocês",
    createdAt: "13:45",
  },
  {
    id: "msg-5-2",
    conversationId: "conv-5",
    sender: "hermes",
    direction: "outbound",
    content:
      "Boa tarde, Juliana! Oferecemos vários tratamentos: limpeza, clareamento, restaurações, implantes e muito mais. O que você tem interesse?",
    createdAt: "13:46",
  },
  {
    id: "msg-5-3",
    conversationId: "conv-5",
    sender: "contact",
    direction: "inbound",
    content: "Qual o valor da consulta de avaliação?",
    createdAt: "14:01",
  },

  // conv-6: Marcos Oliveira
  {
    id: "msg-6-1",
    conversationId: "conv-6",
    sender: "contact",
    direction: "inbound",
    content: "Bom dia! Gostaria de marcar uma limpeza",
    createdAt: "11:30",
  },
  {
    id: "msg-6-2",
    conversationId: "conv-6",
    sender: "hermes",
    direction: "outbound",
    content: "Bom dia, Marcos! Claro, temos horários disponíveis. Qual dia seria melhor para você?",
    createdAt: "11:31",
  },
  {
    id: "msg-6-3",
    conversationId: "conv-6",
    sender: "contact",
    direction: "inbound",
    content: "Pode ser na sexta de manhã",
    createdAt: "11:48",
  },
];
