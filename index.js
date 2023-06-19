const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const app = express()
const SSLCommerzPayment = require('sslcommerz-lts')
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mj9te36.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false //true for live, false for sandbox


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();
    // Send a ping to confirm a successful connection
    const instructorCollection = client.db("MusicineDB").collection("instructors");
    const classCollection = client.db("MusicineDB").collection("classes");
    const usersCollection = client.db("MusicineDB").collection("users");
    const addClassCollection = client.db("MusicineDB").collection("addClass");
    const selectClassCollection = client.db("MusicineDB").collection("selectClass");
    const paymentCollection = client.db("MusicineDB").collection("payment");



    // all instructor
    app.get('/instructors', async (req, res) => {
      const result = await instructorCollection.find().toArray();
      res.send(result);
    });
    // all classes
    app.get('/class', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });



    app.put('/class/:id', async (req, res) => {
      const id = req.params.id;
      const update = req.body;
      console.log("class:", id)
      const filter = { _id: id };
      console.log(filter)
      const options = { upsert: true };
      const updateSeats = {
        $set: {
          availableSeats: update.availableSeats,
          enrolled: update.enrolled
        }
      }
      const result = await classCollection.updateOne(filter, updateSeats, options);
      res.send(result)

    })

    app.post('/class', async (req, res) => {
      const addClass = req.body;
      console.log(addClass)
      const result = await classCollection.insertOne(addClass);
      res.send(result);
    })

    // user collection
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      console.log(existingUser)
      if (existingUser) {
        return res.send({ message: 'user already exist' })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateAdmin = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollection.updateOne(filter, updateAdmin);
      res.send(result);

    })
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateInstructor = {
        $set: {
          role: 'instructor'
        },
      };

      const result = await usersCollection.updateOne(filter, updateInstructor);
      res.send(result);

    })

    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;
      if (req.params.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' };
      res.send(result);
    });

    app.get('/users/instructor/:email', async (req, res) => {
      const email = req.params.email;
      if (req.params.email !== email) {
        res.send({ instructor: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' };
      res.send(result);
    });

    app.get('/addClass', async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const result = await addClassCollection.find(query).toArray();
      res.send(result);
    })
    app.get('/addClass', async (req, res) => {
      const result = await addClassCollection.find().toArray();
      res.send(result);
    });

    app.post('/addClass', async (req, res) => {
      const addClass = req.body;
      const result = await addClassCollection.insertOne(addClass);
      res.send(result);
    })


    app.patch('/addClass/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateClass = req.body;
      const updateDoc = {
        $set: {
          status: updateClass.status,
        },
      };
      const result = await addClassCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    app.put('/addClass/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateInfo = req.body;
      const updateFeedback = {
        $set: {
          feedback: updateInfo.feedback,
        },
      };
      console.log(updateFeedback)
      const result = await addClassCollection.updateOne(filter, updateFeedback);
      res.send(result)
    })

    app.get('/selectClass', async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const result = await selectClassCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/selectClass', async (req, res) => {
      const addClass = req.body;
      console.log(addClass);
      const selectClass = await selectClassCollection.insertOne(addClass);
      res.send(selectClass);
    });


    app.delete('/selectClass/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id); // Check the value of `id`
      const query = { _id: new ObjectId(id) };
      const result = await selectClassCollection.deleteOne(query);
      res.send(result);
    });

    // create payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    app.get('/enrolledClass/sort', async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }

      const sortField = req.query?.sortField || 'date'; // Default sort field is 'date'
      const sortOrder = req.query?.sortOrder || 'asc'; // Default sort order is 'asc'

      const sortOptions = {};
      if (sortField === 'date') {
        if (sortOrder === 'desc') {
          sortOptions['date'] = -1;
        } else {
          sortOptions['date'] = 1;
        }
      } else {
        sortOptions[sortField] = sortOrder === 'desc' ? -1 : 1;
      }

      const result = await paymentCollection.find(query).sort(sortOptions).toArray();
      res.send(result);
    });




    app.post('/payment', async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);
      const query = { _id: { $in: payment.item.map(id => new ObjectId(id)) } }
      console.log(query)
      const deleteItems = await selectClassCollection.deleteMany(query)
      res.send({ insertResult, deleteItems });
    })

    app.get('/admin-status', async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const classes = await classCollection.estimatedDocumentCount();
      const payments = await paymentCollection.find().toArray();
      const revenue = payments.reduce((sum, payments) => sum + payments.price, 0)
      res.send({
        users,
        classes,
        revenue
      })
    })

    app.post('/orders', async (req, res) => {
      const { price } = req.body;
      const order = req.body;

      const tran_id = new ObjectId().toString();
      const data = {
        total_amount: price,
        currency: order.currency,
        tran_id: tran_id, // use unique tran_id for each api call
        success_url: `http://localhost:5000/success/${tran_id}`,
        fail_url: 'http://localhost:3030/fail',
        cancel_url: 'http://localhost:3030/cancel',
        ipn_url: 'http://localhost:3030/ipn',
        shipping_method: 'Courier',
        product_name: 'Computer.',
        product_category: 'Electronic',
        product_profile: 'general',
        cus_name: order.userName,
        cus_email: order.email,
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: '01711111111',
        cus_fax: '01711111111',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
      };
      console.log(data)
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
      sslcz.init(data).then(apiResponse => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL
        res.send({ url: GatewayPageURL })
        console.log('Redirecting to: ', GatewayPageURL)
      });

      app.post('/payment/success/:tranId', async (req, res) => {
        console.log(req.params.id);
      })
    })

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Summer Is Running')
})

app.listen(port, () => {
  console.log(`Summer Is Running On Port  ${port}`)
})