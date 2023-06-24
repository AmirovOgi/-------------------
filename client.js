const socket = io();

socket.on('connect', () => {
  console.log('Connected to server:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server:', socket.id);
});

async function getUrls(keyword) {
  const response = await axios.get(`/urls/${keyword}`);
  return response.data;
}

function updateProgress({ totalSize, loadedSize, downloadProgress }) {
  const progress = downloadProgress.map((p) => `${p}%`).join(' | ');
  console.log(`Total size: ${totalSize}, Loaded size: ${loadedSize}, Progress: ${progress}`);
}

function saveContent(filename, content) {
  localStorage.setItem(filename, content);
  console.log(`Saved '${filename}' to LocalStorage`);
}

async function downloadContent(keyword, url) {
  try {
    const { hostname, pathname } = new URL(url);
    const response = await axios.post('/download', { keyword, hostname, pathname });
    const { filename, content } = response.data;
    saveContent(filename, content);
  } catch (err) {
    console.error(err);
  }
}

const form = document.querySelector('form');
const input = document.querySelector('input[type="text"]');
const ul = document.querySelector('ul');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const keyword = input.value.trim().toLowerCase();
  if (!keyword) return;

  try {
    const urls = await getUrls(keyword);
    ul.innerHTML = '';
    urls.forEach((url) => {
      const li = document.createElement('li');
      li.textContent = url;
      li.addEventListener('click', () => { downloadContent(keyword, url); });
      ul.appendChild(li);
    });
  } catch (err) {
    console.error(err);
  }
});

socket.on('update', updateProgress);

socket.on('downloaded', ({ filename, content }) => {
  saveContent(filename, content);
});

socket.on('error', (err) => {
  console.error(err);
});
