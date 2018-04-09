var set = require("./src/set");
var canSymbol = require("can-symbol");
var canReflect = require("can-reflect");
var makeBasicQueryConvert = require("./src/serializers/basic-query");
var BasicQuery = require("./src/types/basic-query");
var schemaSymbol = canSymbol.for("can.schema");



// Creates an algebra used to convert primitives to types and back
function QueryLogic(Type, options){
    Type = Type || {};
    var passedHydrator = options && options.toQuery;
    var passedSerializer = options && options.toParams;
    var schema;
    if(Type[schemaSymbol]) {
        schema = Type[schemaSymbol]();
    } else {
        schema = Type;
    }

    // check that the basics are here

    var id = schema.identity && schema.identity[0];
    if(!id) {
        //console.warn("can-query given a type without an identity schema.  Using `id` as the identity id.");
        schema.identity = ["id"];
    }


    var properties = schema.properties;

    if(!properties) {
        //console.warn("can-query given a type without a properties schema.  Using an empty schema.");
        schema.properties = {};
    }

    var converter = makeBasicQueryConvert(schema),
        hydrate,
        serialize;

    if(passedHydrator) {
        hydrate = function(query){
            return converter.hydrate(passedHydrator(query));
        };
    } else {
        hydrate = converter.hydrate;
    }

    if(passedSerializer) {
        serialize = function(query){
            return passedSerializer(converter.serializer.serialize(query));
        };
    } else {
        serialize = converter.serializer.serialize;
    }
    this.hydrate = hydrate;
    this.serialize = serialize;
    this.schema = schema;

}

function makeNewSet(prop){
    return function(qA, qB){
        var queryA = this.hydrate(qA),
            queryB = this.hydrate(qB);
        var unionQuery = set[prop](queryA , queryB );
        return this.serialize( unionQuery );
    };
}

function makeReturnValue(prop) {
    return function(qA, qB){
        var queryA = this.hydrate(qA),
            queryB = this.hydrate(qB);
        return set[prop](queryA , queryB );
    };
}

canReflect.assignSymbols(QueryLogic.prototype,{
    "can.getSchema": function(){
        return this.schema;
    }
});

canReflect.assign(QueryLogic.prototype,{
    union: makeNewSet("union"),
    difference: makeNewSet("difference"),
    intersection: makeNewSet("intersection"),

    isEqual: makeReturnValue("isEqual"),
    isProperSubset: makeReturnValue("isProperSubset"),
    isSubset: makeReturnValue("isSubset"),

    isSpecial: set.isSpecial,
    isDefinedAndHasMembers: set.isDefinedAndHasMembers,

    count: function(a){
        var queryA = this.hydrate(a);
        return queryA.page.end - queryA.page.start + 1;
    },

    // identity keys
    identityKeys: function(){
        console.warn("you probably can get the identity keys some other way");
        return this.schema.identity;
    },

    filterMembers: function(a, b, bData){
        var queryA = this.hydrate(a);
        if(arguments.length >= 3) {
            var queryB = this.hydrate(b);
            return queryA.filterFrom(bData, queryB);
        } else {
            return queryA.filterFrom(b);
        }

    },
    // filterMembersAndGetCount
    filterMembersAndGetCount: function(a, b, bData) {
        var queryA = this.hydrate(a),
            queryB = this.hydrate(b);
        return queryA.filterMembersAndGetCount(bData, queryB);
    },
    // unionMembers
    unionMembers: function(a, b, aData, bData) {
        var queryA = this.hydrate(a),
            queryB = this.hydrate(b);

        return queryA.merge(queryB, aData, bData, this.memberIdentity.bind(this));
    },
    // isMember
    isMember: function(query, props) {
        return this.hydrate(query).isMember(props);
    },

    memberIdentity: function(props) {
        console.warn("you probably can get the member identity some other way");
        return canReflect.getIdentity(props, this.schema);
    },
    index: function(query, items, props){
        return this.hydrate(query).index(props, items);
    },

    insert: function(query, items, item){
    	var index = this.index(query, items, item);
    	if(index === undefined) {
    		index = items.length;
    	}

    	var copy = items.slice(0);
    	copy.splice(index, 0, item);

    	return copy;
    }

});

QueryLogic.UNIVERSAL = set.UNIVERSAL;
// Nothing
QueryLogic.EMPTY = set.EMPTY;
// The set exists, but we lack the language to represent it.
QueryLogic.UNDEFINABLE = set.UNDEFINABLE;

// We don't know if this exists. Intersection between two paginated sets.
QueryLogic.UNKNOWABLE = set.UNKNOWABLE;

QueryLogic.defineComparison = set.defineComparison;

QueryLogic.And = BasicQuery.And;
QueryLogic.Or = BasicQuery.Or;

module.exports = QueryLogic;
