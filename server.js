const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const axios = require('axios');

const PORT = process.env.PORT || 3000;

// Хранилище соответствия ключевых слов и URL
const urls = {
  'node.js': [
    'https://nodejs.org/dist/latest-v14.x/docs/api',
    'https://github.com/nodejs/node/blob/master/doc/api',
  ],
  'npm': [
    'https://docs.npmjs.com/cli/v7',
    'https://github.com/npm/cli/tree/latest/docs',
  ],
  // ...
};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('download', async ({ keyword, hostname, pathname }) => {
    const url = `https://${hostname}${pathname}`;
    try {
      const response = await axios.get(url, { responseType: 'stream' });
      const totalSize = +response.headers['content-length'];
      const chunkSize = Math.ceil(totalSize / 5); // 5 потоков
      let loadedSize = 0;
      let downloadProgress = Array(5).fill(0);
      const chunks = Array.from({ length: 5 }, (_, i) => ({
        start: i * chunkSize,
        end: i === 4 ? '' : (i + 1) * chunkSize - 1,
        size: 0,
        buffer: Buffer.alloc(0),
      }));
      let promises = [];

      // Создаем 5 потоков и запускаем скачивание частей контента
      chunks.forEach((chunk, i) => {
        if (chunk.end !== '') {
          promises.push(
            axios.get(url, {
              responseType: 'stream',
              headers: { Range: `bytes=${chunk.start}-${chunk.end}` },
            })
            .then((res) => {
              res.data.on('data', (data) => {
                loadedSize += data.length;
                downloadProgress[i] = Math.floor(loadedSize / totalSize * 100);
                chunk.buffer = Buffer.concat([chunk.buffer, data]);
                chunk.size += data.length;
                io.to(socket.id).emit('update', {
                  totalSize,
                  loadedSize,
                  downloadProgress,
                });
              });
              return new Promise((resolve, reject) => {
                res.data.on('end', () => resolve(chunk));
                res.data.on('error', reject);
              });
            })
          );
        }
      });

      // Объединяем части контента в единый буфер
      Promise.all(promises)
      .then((chunks) => {
        const contentBuffer = Buffer.concat(chunks.map((chunk) => chunk.buffer));
        const content = contentBuffer.toString('base64');
        const filename = `${keyword}_${Date.now()}`;

        // Отправляем клиенту информацию о загруженном контенте
        io.to(socket.id).emit('downloaded', { filename, content });
      });
    } catch (err) {
      console.error(err);
      io.to(socket.id).emit('error', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Маршрут для получения списка URL по ключевому слову
app.get('/urls/:keyword', (req, res) => {
  const keyword = req.params.keyword.toLowerCase();
  if (!urls[keyword]) {
    return res.status(404).send(`No URLs found for '${keyword}'`);
  }
  res.json(urls[keyword]);
});

server.listen(PORT, () => console.log(`Server started on port ${PORT}`));