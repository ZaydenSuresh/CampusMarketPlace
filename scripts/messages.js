'use strict';

let conversations = [];
let activeConversationId = null;


const convList = document.getElementById('conversation-list');
const searchInput = document.getElementById('search-input');
const emptyState = document.getElementById('empty-state');
const chatView = document.getElementById('chat-view');
const chatHeaderAvatar = document.getElementById('chat-header-avatar');
const chatHeaderName = document.getElementById('chat-header-name');
const chatHeaderStatus = document.getElementById('chat-header-status');
const messagesList = document.getElementById('messages-list');
const messagesScroll = document.getElementById('messages-scroll');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

function initials(name) {
  return String(name || '?')
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(dateValue) {
  const date = new Date(dateValue);
  return date.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatSidebarTime(dateValue) {
  const date = new Date(dateValue);
  return date.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short'
  });
}

function formatDayLabel(dateValue) {
  const date = new Date(dateValue);
  return date.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function getConversationById(conversationId) {
  return conversations.find(conversation => conversation.id === conversationId);
}

function getLastMessage(conversation) {
  if (!conversation.messages || !conversation.messages.length) return null;
  return conversation.messages[conversation.messages.length - 1];
}

function scrollMessagesToBottom() {
  messagesScroll.scrollTop = messagesScroll.scrollHeight;
}


async function fetchConversations() {
  return [];
}

async function fetchMessages(conversationId) {
  const conversation = getConversationById(conversationId);
  return conversation && Array.isArray(conversation.messages)
    ? conversation.messages
    : [];
}

async function postMessage(conversationId, text) {
  return null;
}


function renderConversationList(conversationItems) {
  const query = searchInput.value.trim().toLowerCase();
  convList.innerHTML = '';

  const filteredConversations = conversationItems.filter(conversation => {
    const lastMessage = getLastMessage(conversation);
    const userName = conversation.user?.name || '';
    const nameMatch = userName.toLowerCase().includes(query);
    const messageMatch = lastMessage
      ? String(lastMessage.text).toLowerCase().includes(query)
      : false;

    return !query || nameMatch || messageMatch;
  });

  filteredConversations.forEach(conversation => {
    const item = document.createElement('li');
    item.className = 'conv-item';

    if (conversation.id === activeConversationId) {
      item.classList.add('active');
    }

    const avatar = document.createElement('span');
    avatar.className = 'conv-avatar';
    avatar.textContent = initials(conversation.user?.name);

    const body = document.createElement('section');
    body.className = 'conv-body';

    const name = document.createElement('section');
    name.className = 'conv-name';
    name.textContent = conversation.user?.name || 'Unknown User';

    const preview = document.createElement('section');
    preview.className = 'conv-preview';
    preview.textContent = getLastMessage(conversation)
      ? getLastMessage(conversation).text
      : 'No messages yet';

    body.appendChild(name);
    body.appendChild(preview);

    const meta = document.createElement('section');
    meta.className = 'conv-meta';

    const time = document.createElement('section');
    time.className = 'conv-time';
    time.textContent = getLastMessage(conversation)
      ? formatSidebarTime(getLastMessage(conversation).ts)
      : '';

    meta.appendChild(time);

    if ((conversation.unread || 0) > 0) {
      const unread = document.createElement('span');
      unread.className = 'conv-unread';
      unread.textContent = conversation.unread;
      meta.appendChild(unread);
    }

    item.appendChild(avatar);
    item.appendChild(body);
    item.appendChild(meta);

    item.addEventListener('click', () => {
      openConversation(conversation.id);
    });

    convList.appendChild(item);
  });
}

function renderHeader(conversation) {
  chatHeaderAvatar.textContent = initials(conversation.user?.name);
  chatHeaderName.textContent = conversation.user?.name || 'Unknown User';
  chatHeaderStatus.textContent = 'Active now';
}

function buildMessageItem(message, conversation) {
  const isMine = message.from === 'me';

  const item = document.createElement('li');
  item.className = `msg-row ${isMine ? 'me' : 'them'}`;

  const avatar = document.createElement('span');
  avatar.className = 'msg-avatar';
  avatar.textContent = initials(isMine ? 'You' : conversation.user?.name);

  const bubble = document.createElement('section');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = escapeHtml(message.text);

  const time = document.createElement('span');
  time.className = 'msg-time';
  time.textContent = formatTime(message.ts);

  if (isMine) {
    item.appendChild(time);
    item.appendChild(bubble);
    item.appendChild(avatar);
  } else {
    item.appendChild(avatar);
    item.appendChild(bubble);
    item.appendChild(time);
  }

  return item;
}

function renderMessages(conversation, messages) {
  messagesList.innerHTML = '';

  let previousDay = '';

  messages.forEach(message => {
    const currentDay = formatDayLabel(message.ts);

    if (currentDay !== previousDay) {
      const divider = document.createElement('li');
      divider.className = 'day-divider';
      divider.textContent = currentDay;
      messagesList.appendChild(divider);
      previousDay = currentDay;
    }

    messagesList.appendChild(buildMessageItem(message, conversation));
  });

  scrollMessagesToBottom();
}


async function openConversation(conversationId) {
  const conversation = getConversationById(conversationId);
  if (!conversation) return;

  activeConversationId = conversationId;
  conversation.unread = 0;

  const messages = await fetchMessages(conversationId);

  emptyState.classList.add('hidden');
  chatView.classList.remove('hidden');

  renderHeader(conversation);
  renderMessages(conversation, messages);
  renderConversationList(conversations);

  messageInput.focus();
  toggleSendButton();
}

function toggleSendButton() {
  sendBtn.disabled = messageInput.value.trim() === '' || !activeConversationId;
}

async function handleSendMessage() {
  const text = messageInput.value.trim();
  if (!text || !activeConversationId) return;

  const result = await postMessage(activeConversationId, text);

  if (!result) {
    return;
  }

  const conversation = getConversationById(activeConversationId);
  const messages = await fetchMessages(activeConversationId);

  if (conversation) {
    renderMessages(conversation, messages);
    renderConversationList(conversations);
  }

  messageInput.value = '';
  toggleSendButton();
}


async function initMessagesPage() {
  conversations = await fetchConversations();

  renderConversationList(conversations);

  if (!conversations.length) {
    emptyState.classList.remove('hidden');
    chatView.classList.add('hidden');
    activeConversationId = null;
    toggleSendButton();
    return;
  }

  activeConversationId = conversations[0].id;
  openConversation(activeConversationId);
}

searchInput.addEventListener('input', () => {
  renderConversationList(conversations);
});

messageInput.addEventListener('input', toggleSendButton);

messageInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleSendMessage();
  }
});

sendBtn.addEventListener('click', handleSendMessage);

initMessagesPage();