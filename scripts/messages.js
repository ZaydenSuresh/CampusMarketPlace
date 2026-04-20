'use strict';

let conversations = [];
let activeConversationId = null;

//Ui elememts refs
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


let currentUser = null;
let currentUserId = null;

async function loadSessionUser() {
  const res = await fetch("http://localhost:3000/auth/me", {
    credentials: "include"
  });

  const data = await res.json();

  if (!data.ok) {
    window.location.href = "/login.html";
    return;
  }

  currentUser = data.user.name;
  currentUserId = data.user.id;

  console.log("SESSION USER:", data.user);
}


function getConversationById(conversationId) {
  return conversations.find(conversation => conversation.id === conversationId);
}

function getLastMessage(conversation) {
  if (!conversation.messages || !conversation.messages.length) return null;
  return conversation.messages[conversation.messages.length - 1];
}

function scrollMessagesToBottom() {//scroll chats to latest msg
  messagesScroll.scrollTop = messagesScroll.scrollHeight;
}


async function getUserName(id) {
  const res = await fetch(`http://localhost:3000/profiles/${id}`);
  const data = await res.json();
  return data.name;
}

async function fetchConversations() {
  const res = await fetch(
    `http://localhost:3000/messages/conversations/${encodeURIComponent(currentUser)}`
  );

  const data = await res.json();

  // Fetch names one-by-one (simple version, no Promise.all)
  for (let conv of data) {
    let otherUserId =
      conv.user2_id === currentUserId
        ? conv.user1_id
        : conv.user2_id;

    try {
      const res = await fetch(`http://localhost:3000/auth/profiles/${otherUserId}`);
      const profile = await res.json();

      console.log(profile);

      conv.otherUserName = profile.name;
    } catch {
      conv.otherUserName = "Unknown";
    }
  }
  
  
  return data.map(conv => ({
    id: conv.id,
    user: conv.user2_id === currentUserId
      ? { id: conv.user1_id, name: conv.otherUserName }
      : { id: conv.user2_id, name: conv.otherUserName }
  }));
}

async function postMessage(conversationId, text) {
  const conversation = getConversationById(conversationId);
  if (!conversation) return null;

  const res = await fetch("http://localhost:3000/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sender_name: currentUser,
      receiver_name: conversation.user.name,
      content: text
    })
  });

  return await res.json();
}

async function fetchMessages(conversationId) {
  const res = await fetch(
    `http://localhost:3000/messages/conversation/${conversationId}`
  );

  const data = await res.json();

  return data.map(msg => ({
    text: msg.content,
    ts: msg.created_at,
    from: msg.sender_id === currentUserId ? 'me' : 'them'
  }));
}

function renderConversationList(list) {//render sidebare conv list(search filtering+active highlight)
  const query = searchInput.value.trim().toLowerCase();
  convList.innerHTML = '';

  const filtered = list.filter(c =>
    !query || c.user.name.toLowerCase().includes(query)
  );

  filtered.forEach(conv => {
    const li = document.createElement('li');
    li.className = 'conv-item';

    if (conv.id === activeConversationId) {
      li.classList.add('active');
    }

    li.innerHTML = `
      <span class="conv-avatar">${initials(conv.user.name)}</span>
      <section class="conv-body">
        <section class="conv-name">${conv.user.name}</section>
        <section class="conv-preview">Click to open chat</section>
      </section>
    `;

    li.addEventListener('click', () => openConversation(conv.id));

    convList.appendChild(li);
  });
}

function renderHeader(conversation) {//update chat header when conv open
  chatHeaderAvatar.textContent = initials(conversation.user?.name);
  chatHeaderName.textContent = conversation.user?.name || 'Unknown User';
  chatHeaderStatus.textContent = 'Active now';
}

function buildMessageItem(message, conversation) {//create single msg elem(bubb+avatar+time)
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

function renderMessages(conversation, messages) {//renders all msgs in chat(date seperators)
  messagesList.innerHTML = '';//clear prev msgs

  let previousDay = '';//tracks last msg day

  messages.forEach(message => {
    const currentDay = formatDayLabel(message.ts);//get formatted date for msg

    if (currentDay !== previousDay) {
      const divider = document.createElement('li');//date divider
      divider.className = 'day-divider';
      divider.textContent = currentDay;//display date
      messagesList.appendChild(divider);//insert div into list
      previousDay = currentDay;
    }

    messagesList.appendChild(buildMessageItem(message, conversation));
  });

  scrollMessagesToBottom();
}


async function openConversation(conversationId) {
  const conversation = getConversationById(conversationId);//find selected conv
  if (!conversation) return;

  activeConversationId = conversationId;//set active chat
  conversation.unread = 0;//clear unread count

  const messages = await fetchMessages(conversationId);

  emptyState.classList.add('hidden');//hide mpt state
  chatView.classList.remove('hidden');

  renderHeader(conversation);//update header
  renderMessages(conversation, messages);//display msgs
  renderConversationList(conversations);//refresh sidebar

  messageInput.focus();
  toggleSendButton();
}

function toggleSendButton() {//enables or disbales send btn
  sendBtn.disabled = messageInput.value.trim() === '' || !activeConversationId;
}

async function handleSendMessage() {
  const text = messageInput.value.trim();//get tuped msg
  if (!text || !activeConversationId) return;//prevent send empty msgs

  await postMessage(activeConversationId, text);//send msg to backend

  messageInput.value = '';//clear input field

  const conversation = getConversationById(activeConversationId);//get curr conv
  const messages = await fetchMessages(activeConversationId);//reloads updated msgs

  renderMessages(conversation, messages);
  renderConversationList(conversations);//update sidebar
  toggleSendButton();//disable btn if inp is empty
}




async function initMessagesPage() {//set up page when load
  conversations = await fetchConversations();

  renderConversationList(conversations);

  if (!conversations.length) {//if no convs,  show page when no conv
    emptyState.classList.remove('hidden');
    chatView.classList.add('hidden');
    activeConversationId = null;
    toggleSendButton();
    return;
  }

  activeConversationId = conversations[0].id;//open first conv automatically
  openConversation(activeConversationId);
}

searchInput.addEventListener('input', () => {
  renderConversationList(conversations);//filter conv list as user types
});

messageInput.addEventListener('input', toggleSendButton);//check if send btn=enable whil typing

messageInput.addEventListener('keydown', event => {//let user press enter to send msg
  if (event.key === 'Enter') {
    event.preventDefault();
    handleSendMessage();
  }
});

sendBtn.addEventListener('click', handleSendMessage);//send msg when send btn clicked

async function bootstrap() {
  await loadSessionUser();
  await initMessagesPage();
}

bootstrap();