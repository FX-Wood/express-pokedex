var express = require('express');
var router = express.Router();
const request = require('request');
const db = require('../models');
const fs = require('fs');
// HELPERS
//url getter
const uri = {
  pokemon: (endpoint) => ('https://pokeapi.co/api/v2/pokemon/' + endpoint).toLowerCase(),
  species: (endpoint) => ('https://pokeapi.co/api/v2/pokemon-species/' + endpoint).toLowerCase(),
  move: (endpoint) => 'https://pokeapi.co/api/v2/move/' + endpoint
};

// filter for language of entries
function languageFilter(obj) {
  return obj.language.name === 'en'? true : false
}
// filter for move descriptions
function moveFlavorFilter(enMoves) {
  if (enMoves.version_group.name === 'ultra-sun-ultra-moon' ||  enMoves.version_group.name === 'emerald' || enMoves.version_group.name === 'gold-silver') {
    return true
  } else {
    return false
  }
}
const props = {
  want: {
    move: ["id", "pp", "accuracy", "flavor_text_entries", "meta",  "type", "generation", "effect_entries", "effect_chance", "priority", "name"]
  },
  total: {
    move: ["accuracy", "contest_combos", "contest_effect", "contest_type", "damage_class", "effect_chance", "effect_changes", "effect_entries", "flavor_text_entries", "generation", "id", "machines", "meta", "name", "names", "past_values", "power", "pp", "priority", "stat_changes", "super_contest_effect", "target", "type"]
  }
}
// request logger
const reqLog = function(context) {
  console.log('error: ', context.error)
  console.log('statusCode: ', context.response && context.statusCode)
  console.log('body:', context.body)
}
// make first letter uppercase
const titleCase = function(str) {
  return str.replace(str.charAt(0), str.charAt(0).toUpperCase())
}

// GET /pokemon - return a page with favorited Pokemon
router.get('/', function(req, res) {
  // TODO: Get all records from the DB and render to view
  db.favorite.findAll()
  .then(favs => {
    res.render('pokemon/index', {favs})
  })
});

// POST /pokemon - receive the name of a pokemon and add it to the database
router.post('/', function(req, res) {
  
  db.favorite.findOrCreate({
    where: {name: titleCase(req.body.name)}
  })
  .spread(dbOut => {
    res.redirect('/pokemon');
  })
});

router.get('/:name', function(req, res) {
  console.log(req.originalUrl)
  console.log(req.params.name)
  // GET POKEMON DATA
  request(uri.pokemon(req.params.name), function(error, response, body) {
    reqLog(this)
    let pokemon = JSON.parse(body)
    
    
    // GET SPECIES DATA
    request(uri.species(req.params.name), function(error, response, body) {
      reqLog(this)
      let species = JSON.parse(body)
      species.flavor_text_entries = species.flavor_text_entries.filter(languageFilter)

      // GET DATA FOR EACH MOVE
      let extendedMoves = [];
      pokemon.moves.forEach((element, i) => {
        console.log('making a request for', uri.move(element.move.name))
        request(uri.move(element.move.name), function(error, response, body) {
          console.log('on move', i, 'of', pokemon.moves.length)
          let output = {}
          let moveObj = JSON.parse(body);
          // REMOVE EMPTY METAS
          for (let attr in moveObj['meta']) {
            if (moveObj['meta'][attr] == null) {
              delete moveObj['meta'][attr]
            }
          }
          for (let key of props.want.move) {
            if (key === 'flavor_text_entries') {
              let entries = moveObj[key].filter(languageFilter).filter(moveFlavorFilter);
              console.log(entries)
              output[key] = entries.map(entry => {
                return {
                  [entry.version_group.name]: {flavor_text: entry.flavor_text},
                  language: {name: 'en'}
                }
              })
            } else if (moveObj[key]) {
                output[key] = moveObj[key]
            }
          }
          extendedMoves.push({[element.move.name] : output});
          if (i === pokemon.moves.length - 1 ) {
            fs.writeFileSync('public/log.json', JSON.stringify(extendedMoves))
            db.favorite.findOne({
              where: {name: req.params.name}
            })
            .then(fav => {
              res.render('pokemon/show', {fav, pokemon, species, extendedMoves})
            })
          }
        })
        })
      })
    })
  })

router.delete('/:name', function(req, res) {
  db.favorite.destroy({
    where: {name: req.params.name}
  })
  .then(data => {
    res.redirect('/pokemon')
  })
})
module.exports = router;

