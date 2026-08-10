require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI);
const { Artifact } = require('./src/models/artifact');

async function test() {
  const q = 'js';
  const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fuzzyRegex = new RegExp(escapedQ.split('').join('.*?'), 'i');
  
  const filter = {};
  filter.$or = [
    { title: { $regex: fuzzyRegex } },
    { description: { $regex: fuzzyRegex } },
    { tags: { $regex: fuzzyRegex } },
    { category: { $regex: fuzzyRegex } },
    { language: { $regex: fuzzyRegex } },
    { fileType: { $regex: fuzzyRegex } }
  ];

  try {
    const res = await Artifact.find(filter).limit(3).lean();
    console.log(JSON.stringify(res.map(r => ({title: r.title, category: r.category, fileType: r.fileType, tags: r.tags})), null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}
test();
