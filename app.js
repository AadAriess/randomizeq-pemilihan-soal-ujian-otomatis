const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const app = express();

// Koneksi ke MySQL
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "db_randomize",
});

connection.connect();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));

// Routes
app.get("/", (req, res) => {
  const query = `
    SELECT items.*, kategori_soal.nama_kategori AS nama_kategori
    FROM items
    LEFT JOIN kategori_soal ON items.kategori_soal_id = kategori_soal.id
  `;

  connection.query(query, (errorItems, resultsItems) => {
    if (errorItems) {
      throw errorItems;
    }

    connection.query("SELECT * FROM quiz", (errorQuiz, resultsQuiz) => {
      if (errorQuiz) {
        throw errorQuiz;
      }

      res.render("index", { items: resultsItems, quiz: resultsQuiz });
    });
  });
});

// Route for the "Bank Soal" page
app.get("/banksoal", (req, res) => {
  const query = `
    SELECT items.*, kategori_soal.nama_kategori AS nama_kategori
    FROM items
    LEFT JOIN kategori_soal ON items.kategori_soal_id = kategori_soal.id
  `;

  connection.query(query, (errorItems, resultsItems) => {
    if (errorItems) {
      throw errorItems;
    }

    res.render("banksoal", { items: resultsItems });
  });
});

// Route untuk menampilkan formulir addItem
app.get("/addItem", (req, res) => {
  connection.query("SELECT * FROM kategori_soal", (error, categories) => {
    if (error) {
      console.error(error);
      return res.status(500).send("Internal Server Error");
    }

    res.render("addItem", { categories });
  });
});

app.post("/addItem", (req, res) => {
  const {
    soal,
    opta,
    optb,
    optc,
    optd,
    opte,
    kunci_jawaban,
    tingkat_kesulitan,
    kategori_soal,
    new_kategori_soal,
    hidden_kategori_soal_id,
  } = req.body;

  // Validasi di sisi server
  if (
    !soal ||
    !opta ||
    !optb ||
    !optc ||
    !optd ||
    !opte ||
    !kunci_jawaban ||
    !tingkat_kesulitan
  ) {
    return res.status(400).send("Semua kolom harus diisi.");
  }

  // Ambil ID kategori soal dari input tersembunyi
  const kategoriSoalId = hidden_kategori_soal_id || null;

  // Tambahkan item ke tabel items dengan ID kategori soal
  connection.query(
    "INSERT INTO items SET ?, kategori_soal_id = ?",
    [
      { soal, opta, optb, optc, optd, opte, kunci_jawaban, tingkat_kesulitan },
      kategoriSoalId,
    ],
    (error) => {
      if (error) {
        console.error(error);
        return res.status(500).send("Internal Server Error");
      }
      res.redirect("/");
    }
  );
});

app.get("/editItem/:id", (req, res) => {
  const itemId = req.params.id;

  // Ambil detail item
  connection.query(
    "SELECT * FROM items WHERE id = ?",
    [itemId],
    (errorItem, resultItem) => {
      if (errorItem) {
        console.error(errorItem);
        return res.status(500).send("Internal Server Error");
      }

      // Ambil daftar kategori soal
      connection.query(
        "SELECT * FROM kategori_soal",
        (errorCategories, resultsCategories) => {
          if (errorCategories) {
            console.error(errorCategories);
            return res.status(500).send("Internal Server Error");
          }

          // Render halaman edit.ejs dengan detail item dan daftar kategori soal
          res.render("edit", {
            item: resultItem[0],
            categories: resultsCategories,
          });
        }
      );
    }
  );
});

// Route untuk menangani update item
app.post("/updateItem/:id", (req, res) => {
  const itemId = req.params.id;
  const {
    soal,
    opta,
    optb,
    optc,
    optd,
    opte,
    kunci_jawaban,
    tingkat_kesulitan,
    kategori_soal_baru,
    hidden_kategori_soal_id,
  } = req.body;

  // Ambil ID kategori soal dari input tersembunyi atau formulir
  const kategoriSoalId = hidden_kategori_soal_id || null;

  // Tentukan ID kategori soal yang baru (dari formulir jika ada, atau dari yang lama)
  const newKategoriSoalId = kategori_soal_baru || kategoriSoalId;

  // Perbarui item di tabel items dengan ID kategori soal
  connection.query(
    "UPDATE items SET ?, kategori_soal_id = ? WHERE id = ?",
    [
      { soal, opta, optb, optc, optd, opte, kunci_jawaban, tingkat_kesulitan },
      newKategoriSoalId,
      itemId,
    ],
    (error) => {
      if (error) {
        console.error(error);
        return res.status(500).send("Internal Server Error");
      }
      res.redirect("/");
    }
  );
});

app.get("/deleteItem/:id", (req, res) => {
  const itemId = req.params.id;
  connection.query("DELETE FROM items WHERE id = ?", [itemId], (error) => {
    if (error) throw error;
    res.redirect("/");
  });
});

app.post("/deleteQuiz", (req, res) => {
  const kodeQuizToDelete = req.body.kodeQuiz;
  connection.query(
    "DELETE FROM quiz WHERE kodeQuiz = ?",
    [kodeQuizToDelete],
    (error, result) => {
      if (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      } else {
        res.redirect("/");
      }
    }
  );
});

const getRandomItems = (count, callback) => {
  connection.query(
    "SELECT * FROM items WHERE tingkat_kesulitan = 'Sulit' AND RAND() < 0.8 OR tingkat_kesulitan = 'Mudah' AND RAND() < 0.2 ORDER BY RAND() LIMIT ?",
    parseInt(count),
    (error, results) => {
      if (error) throw error;
      callback(results);
    }
  );
};

app.get("/randomItems", (req, res) => {
  res.render("randomItems", { items: null });
});

app.post("/randomItems", (req, res) => {
  const count = req.body.itemCount || 1; // Default to 2 items if count not provided
  getRandomItems(count, (items) => {
    res.render("randomItems", { items: items });
  });
});

app.post("/addToQuiz", async (req, res) => {
  try {
    const kodeQuiz = req.body.kodeQuiz; // Ambil nilai "kodeQuiz" dari formulir
    const items = JSON.parse(req.body.items);
    const soalIds = items.map((item) => item.id);

    await addToQuiz(kodeQuiz, soalIds);
    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

const addToQuiz = async (kodeQuiz, soalIds) => {
  const values = soalIds.map((id) => [kodeQuiz, id]);

  return new Promise((resolve, reject) => {
    connection.query(
      "INSERT INTO Quiz (kodeQuiz, itemId) VALUES ?",
      [values],
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
  });
};

// Route untuk menampilkan halaman quiz berdasarkan kode kuis
app.post("/quiz", async (req, res) => {
  try {
    const kodeQuiz = req.body.kodeQuiz;
    const quiz = await getQuizByKode(kodeQuiz);
    if (quiz) {
      res.render("quiz", { quiz });
    } else {
      res.render("quizNotFound", { kodeQuiz });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

const getItemIdsByKodeQuiz = async (kodeQuiz) => {
  return new Promise((resolve, reject) => {
    connection.query(
      "SELECT itemId FROM quiz WHERE kodeQuiz = ?",
      [kodeQuiz],
      (error, results) => {
        if (error) {
          reject(error);
        } else {
          const itemIds = results.map((row) => row.itemId);
          resolve(itemIds);
        }
      }
    );
  });
};

const getSoalsByItemIds = async (itemIds) => {
  return new Promise((resolve, reject) => {
    if (itemIds.length === 0) {
      resolve([]);
      return;
    }
    connection.query(
      "SELECT soal, opta, optb, optc, optd, opte FROM Items WHERE id IN (?)",
      [itemIds],
      (error, results) => {
        if (error) {
          reject(error);
        } else {
          const items = results.map((row) => ({
            soal: row.soal,
            opta: row.opta,
            optb: row.optb,
            optc: row.optc,
            optd: row.optd,
            opte: row.opte,
          }));
          resolve(items);
        }
      }
    );
  });
};

const getQuizByKode = async (kodeQuiz) => {
  return new Promise((resolve, reject) => {
    connection.query(
      "SELECT * FROM quiz WHERE kodeQuiz = ?",
      [kodeQuiz],
      async (error, results) => {
        if (error) {
          reject(error);
        } else {
          if (results.length > 0) {
            const quiz = results[0];
            try {
              const itemIds = await getItemIdsByKodeQuiz(quiz.kodeQuiz);
              const soals = await getSoalsByItemIds(itemIds);
              quiz.soals = soals;
              resolve(quiz);
            } catch (error) {
              reject(error);
            }
          } else {
            resolve(null);
          }
        }
      }
    );
  });
};

// Server listening
app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000/");
});
