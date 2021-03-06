import chai from 'chai';
import Kudu from 'kudu';
import deserialize from '../src/deserializer';

let expect = chai.expect;

describe('Deserializer', () => {

  let kudu;
  let Model;
  let Child;
  let Child2;

  beforeEach(() => {
    kudu = new Kudu();
    Model = kudu.createModel('test', {
      properties: {
        name: {
          type: String,
        },
      },
      relationships: {
        child: { type: 'child' },
        children: { type: 'child', hasMany: true },
      },
    });
    Child = kudu.createModel('child', {
      properties: {
        name: { type: String },
      },
      relationships: {
        deep: { type: 'child2' },
      },
    });
    Child2 = kudu.createModel('child2', {
      properties: {
        name: { type: String },
      },
    });
  });

  it('should throw if not passed anything to deserialize', () => {
    let test = () => deserialize();
    expect(test).to.throw(Error, /Expected an object/);
  });

  it('should throw an error if passed an errors member which is not an array', () => {
    let test = () => deserialize(kudu, { errors: 1 });
    expect(test).to.throw(Error, /array of error objects/);
  });

  it('should throw an error if passed an errors member alongside a data member', () => {
    let test = () => deserialize(kudu, { errors: [ {} ], data: {} });
    expect(test).to.throw(Error, /alongside the "data" member/);
  });

  it('should throw an error referring to valid given errors', () => {
    let test = () => deserialize(kudu, { errors: [ {} ] });
    expect(test).to.throw(Error, /Expected an instance/);
  });

  it('should throw if passed an object without a "data" property', () => {
    let test = () => deserialize(kudu, {});
    expect(test).to.throw(Error, /data/);
  });

  it('should throw if passed an object without a type property', () => {
    let test = () => deserialize(kudu, { data: {} });
    expect(test).to.throw(Error, /"type"/);
  });

  it('should throw if passed an object without an id property', () => {
    let test = () => deserialize(kudu, { data: { type: 'type' } });
    expect(test).to.throw(Error, /"id"/);
  });

  it('should not throw if passed an object without an id property when an id is not required', () => {
    let test = () => deserialize(kudu, { data: { type: 'test' } }, {
      type: 'test',
      requireId: false,
    });
    expect(test).not.to.throw(Error);
  });

  it('should throw if the type refers to a non-existent model', () => {
    let test = () => deserialize(kudu, { data: { type: 'fail', id: '1' } });
    expect(test).to.throw(Error, /model/);
  });

  it('should throw if the expected type does not match the provided type', () => {
    let test = () => deserialize(kudu, { data: { type: 'test', id: '1' } }, {
      type: 'fail',
    });
    expect(test).to.throw(Error, /model/);
  });

  it('should return a Kudu model instance if passed a JSON string', () => {
    let obj = JSON.stringify({
      data: { type: 'test', id: '1' },
    });
    let deserialized = deserialize(kudu, obj, { type: 'test' });
    expect(deserialized).to.be.an.instanceOf(Model);
  });

  it('should return a Kudu model instance if passed an object', () => {
    let obj = {
      data: { type: 'test', id: '1' },
    };
    let deserialized = deserialize(kudu, obj, { type: 'test' });
    expect(deserialized).to.be.an.instanceOf(Model);
  });

  it('should copy "attributes" onto the Kudu model instance', () => {
    let obj = {
      data: { type: 'test', id: '1', attributes: { prop: 'test' } },
    };
    let deserialized = deserialize(kudu, obj, { type: 'test' });
    expect(deserialized).to.have.property('prop', 'test');
  });

  it('should copy the "type" property onto the Kudu model instance', () => {
    let obj = {
      data: { type: 'test', id: '1', attributes: { prop: 'test' } },
    };
    let deserialized = deserialize(kudu, obj, { type: 'test' });
    expect(deserialized).to.have.property('type', 'test');
  });

  it('should copy the "id" property onto the Kudu model instance', () => {
    let obj = {
      data: { type: 'test', id: '1', attributes: { prop: 'test' } },
    };
    let deserialized = deserialize(kudu, obj, { type: 'test' });
    expect(deserialized).to.have.property('id', '1');
  });

  it('should return an array of Kudu model instances if passed a JSON string', () => {
    let obj = JSON.stringify({
      data: [
        { type: 'test', id: '1' },
      ],
    });
    let deserialized = deserialize(kudu, obj, { type: 'test' });
    expect(deserialized).to.be.an('array').of.length(1);
  });

  it('should return an array of mixed Kudu model instances if passed a JSON string', () => {
    let obj = JSON.stringify({
      data: [
        { type: 'test', id: '1' },
        { type: 'child', id: '2' },
      ],
    });
    let deserialized = deserialize(kudu, obj);
    expect(deserialized).to.be.an('array').of.length(2);
  });

  it('should map a compound document onto the instance based on a relationship', () => {
    let obj = JSON.stringify({
      data: {
        type: 'test',
        id: '1',
        attributes: { prop: 'test' },
        relationships: { child: { data: { type: 'child', id: '2' } } },
      },
      included: [
        { type: 'child', id: '2', attributes: { prop: 'test2' } },
      ],
    });
    let deserialized = deserialize(kudu, obj, { type: 'test' });
    expect(deserialized).to.have.property('child')
      .that.is.an.instanceOf(Child).with.property('id', '2');
  });

  it('should map an array of compound documents onto the instance based on a relationship', () => {
    let obj = JSON.stringify({
      data: {
        type: 'test',
        id: '1',
        attributes: { prop: 'test' },
        relationships: { children: { data: [ { type: 'child', id: '2' } ] } },
      },
      included: [
        { type: 'child', id: '2', attributes: { prop: 'test2' } },
      ],
    });
    let deserialized = deserialize(kudu, obj, { type: 'test' });
    expect(deserialized).to.have.property('children')
      .that.is.an('array').with.length(1);
  });

  it('should map an identifier onto an instance when a compound document is not present', () => {
    let obj = JSON.stringify({
      data: {
        type: 'test',
        id: '1',
        attributes: { prop: 'test' },
        relationships: { child: { data: { type: 'child', id: '2' } } },
      },
    });
    let deserialized = deserialize(kudu, obj, { type: 'test' });
    expect(deserialized).to.have.property('child', '2');
  });

  it('should map an array of identifiers onto the instance based on a relationship', () => {
    let obj = JSON.stringify({
      data: {
        type: 'test',
        id: '1',
        attributes: { prop: 'test' },
        relationships: { children: { data: [ { type: 'child', id: '2' } ] } },
      },
    });
    let deserialized = deserialize(kudu, obj, { type: 'test' });
    expect(deserialized).to.have.property('children')
      .that.is.an('array').with.length(1);
  });

  it('should map a compound document onto a deeply nested instance', () => {
    let obj = JSON.stringify({
      data: {
        type: 'test',
        id: '1',
        attributes: { name: 'test' },
        relationships: { children: { data: [ { type: 'child', id: '2' } ] } },
      },
      included: [
        {
          type: 'child',
          id: '2',
          attributes: { name: 'test2' },
          relationships: { deep: { data: { type: 'child2', id: '3' } } },
        },
        {
          type: 'child2',
          id: '3',
          attributes: { name: 'nested' },
        },
      ],
    });
    let deserialized = deserialize(kudu, obj, { type: 'test' });
    expect(deserialized.children[ 0 ]).to.have.property('deep');
  });
});
