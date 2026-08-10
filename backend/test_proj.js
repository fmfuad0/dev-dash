require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI);
const { Artifact } = require('./src/models/artifact');

async function test() {
  try {
    const res = await Artifact.find({ fileType: '.cljs' }).lean();
    console.log(JSON.stringify(res.map(r => ({title: r.title, category: r.category, fileType: r.fileType})), null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}
test();
