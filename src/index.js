const { GraphQLServer } = require('graphql-yoga')
const fetch = require('node-fetch');
require('dotenv').config();

const typeDefs = `
  type Query {
    getRestaurants(city: String): [Restaurant]
    getUsers: [User]
  }

  type Restaurant {
    name: String!
    address: String!
    coords: Location
    type: String
    avgRatings: Float
    visitors: [User]
    isOpen: Boolean
  }

  type Location {
    latitude: Float
    longitude: Float
  }

  type User {
    name: String
    joinDate: String
    restaurantsVisited: [Restaurant]
  }
`

const users = [
  {
    id: 1,
    name: 'Jon Stockdill',
    joinDate: 'April 1, 2018',
  },
  {
    id: 2,
    name: 'John Snow',
    joinDate: 'December 25, 2018',
  }
];

const resolvers = {
  Query: {
    getUsers: () => {
      return users;
    },
    getRestaurants: (parent, args, context, info) => {
      // console.log('PARENT', parent);
      // console.log('ARGS', args);
      // console.log('CONTEXT', context);
      // console.log('INFO', info);

      // if (!context.isAuthorized)  {
      //   return err;
      // }

      const zomatoOptions = {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'user-key': process.env.ZOMATO_KEY,
        }
      };

      const googleKey = process.env.GLOC_KEY;

      return fetch(`https://developers.zomato.com/api/v2.1/locations?query=${args.city}`, zomatoOptions)
        .then(result => result.json())
        .then(data => data.location_suggestions[0].entity_id)
        .then((entityId) => fetch(`https://developers.zomato.com/api/v2.1/search?entity_id=${entityId}&entity_type=city`, zomatoOptions))
        .then(result => result.json())
        .then(data => {
          return data.restaurants.map((rest) => {
            const r = rest.restaurant;
            
            return fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?key=${googleKey}&input=${r.name}&inputtype=textquery`)
              .then(data => data.json())
              .then((googleData) => fetch(`https://maps.googleapis.com/maps/api/place/details/json?key=${googleKey}&placeid=${(googleData.candidates && googleData.candidates.length > 0 && googleData.candidates[0].place_id) || ''}`))
              .then(data => data.json())
              .then((googleData) => {
                return {
                  name: r.name,
                  address: r.location ? r.location.address : '',
                  coords: {
                    longitude: r.location && r.location.longitude,
                    latitude: r.location && r.location.latitude,
                  },
                  type: r.cuisines,
                  avgRatings: r.user_rating && parseFloat(r.user_rating.aggregate_rating),
                  visitors: users,
                  isOpen: googleData.result && googleData.result.opening_hours.open_now,
                }
              })
          }
        )})
        .catch(console.error);
    }
  },
  User: {
    restaurantsVisited: (id) => {
      const user = users.find(user => user.id === id);

      // Get restaurants user has been to
      return [{
        name: 'Mangiano Pronto',
        address: '1400 Wazee St',
        coords: {
          longitude: 123.1,
          latitude: 456.1,
        },
        type: 'Pizza',
        avgRatings: 4.5,
        isOpen: true,
      }];
    }
  }
}

const server = new GraphQLServer({ typeDefs, resolvers })
// middleware: res.user => context
server.start(() => console.log(`Server is running at http://localhost:4000`))
