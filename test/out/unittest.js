(function () {
  'use strict';

  const { assert, expect } = require('chai');

  const delay = (ms=1) => 
    new Promise(y =>
      setTimeout(y, ms, 'timeout') );

  const delay_race = (p, ms=1) => 
    Promise.race([p, delay(ms)]);

  async function * delay_walk(g_in, ms=1) {
    await delay(ms);
    for await (let v of g_in) {
      yield v;
      await delay(ms);} }

  function is_fn(fn) {
    assert.equal('function', typeof fn);
    return fn}

  function is_gen(g) {
    is_fn(g.next);
    is_fn(g.return);
    is_fn(g.throw);
    return g}

  function is_async_iterable(o) {
    assert(null != o[Symbol.asyncIterator], 'async iterable');
    return o}

  async function array_from_ao_iter(g) {
    let res = [];
    for await (let v of g) {
      res.push(v);}
    return res}

  const {
    assign: _obj_assign,
    defineProperties: _obj_props,
  } = Object;

  const {
    isArray: _is_array,
  } = Array;

  const is_ao_iter = g =>
    null != g[Symbol.asyncIterator];

  const _is_fn = v_fn =>
    'function' === typeof v_fn
      && ! is_ao_iter(v_fn);
  const _ret_ident = v => v;

  const _xinvoke$1 = v_fn =>
    _is_fn(v_fn)
      ? v_fn()
      : v_fn;

  function _xpipe_tgt(pipe) {
    if (_is_fn(pipe)) {
      pipe = pipe();
      pipe.next();
      return pipe}

    return pipe.g_in || pipe}

  function * iter(gen_in) {
    yield * _xinvoke$1(gen_in);}

  async function * ao_iter(gen_in) {
    yield * _xinvoke$1(gen_in);}


  function fn_chain(tail, ctx) {
    return _obj_assign(chain,{
      chain, tail: _xinvoke$1(tail)} )

    function chain(fn) {
      chain.tail = fn(chain.tail, ctx);
      return chain} }


  function _wm_pipe_closure(wm_absent) {
    let wm = new WeakMap();
    return pipe =>
      _wm_item(wm,
        pipe.g_in || pipe,
        wm_absent) }

  function _wm_item(wm, wm_key, wm_absent) {
    let item = wm.get(wm_key);
    if (undefined === item) {
      item = wm_absent(wm_key);
      wm.set(wm_key, item);}
    return item}

  const ao_deferred_v = ((() => {
    let y,n,_pset = (a,b) => { y=a, n=b; };
    return p =>(
      p = new Promise(_pset)
    , [p, y, n]) })());

  const ao_deferred = v =>(
    v = ao_deferred_v()
  , {promise: v[0], resolve: v[1], reject: v[2]});

  function ao_fence_v() {
    let p=0, _resume = ()=>{};
    let _pset = a => _resume = a;

    return [
      () => 0 !== p ? p
        : p = new Promise(_pset)

    , v => {p = 0; _resume(v);} ] }


  const _ao_fence_api ={
    stop() {this.fence.done = true;}

  , ao_fork() {
      return ao_fence_fork(this.fence)}

  , [Symbol.asyncIterator]() {
      return this.ao_fork()} };

  function ao_fence_fn(tgt) {
    let f = ao_fence_v();
    if (undefined === tgt) {tgt = f[0];}
    tgt.fence = _obj_assign(tgt, _ao_fence_api);
    return f}

  function ao_fence_obj(tgt) {
    let f = ao_fence_fn(tgt);
    return {__proto__: _ao_fence_api
    , fence: tgt || f[0], reset: f[1]} }


  async function * ao_fence_fork(fence) {
    while (! fence.done) {
      let v = await fence();
      if (fence.done) {
        return v}
      yield v;} }


  // export async function * ao_fence_marks(fence, opt) ::
  //   let {signal, trailing, initial} = opt || {}
  //   let f = true === initial
  //     ? fence() : initial
  //
  //   while ! fence.done ::
  //     let v
  //     if trailing ::
  //       v = await f
  //       f = fence()
  //
  //     else ::
  //       f = fence()
  //       v = await f
  //
  //     if fence.done ::
  //       return v
  //
  //     if _is_fn(signal) ::
  //       yield signal(v)
  //     else if signal ::
  //       yield signal
  //     else yield v

  async function ao_run(gen_in, notify=_ret_ident) {
    for await (let v of _xinvoke$1(gen_in)) {
      notify(v);} }


  async function ao_drive(gen_in, gen_tgt, xform=_ret_ident) {
    gen_tgt = _xpipe_tgt(gen_tgt);
    for await (let v of _xinvoke$1(gen_in)) {
      if (undefined !== gen_tgt) {
        v = xform(v);
        let {done} = await gen_tgt.next(v);
        if (done) {break} } } }


  function ao_step_iter(iterable, multiple) {
    iterable = ao_iter(iterable);
    return {
      async * [Symbol.asyncIterator]() {
        do {
          let {value} = await iterable.next();
          yield value;}
        while (multiple) } } }


  function step_iter(iterable, multiple) {
    iterable = iter(iterable);
    return {
      *[Symbol.iterator]() {
        do {
          let {value} = iterable.next();
          yield value;}
        while (multiple) } } }

  function ao_fork() {
    return ao_fence_fork(this.fence)}

  const _ao_tap_props ={
    ao_fork:{value: ao_fork}
  , chain:{get() {
      return fn_chain(this, this)} } };

  function ao_tap(ag_out) {
    return _obj_props(_ao_tap(ag_out), _ao_tap_props) }

  function _ao_tap(ag_out) {
    let [fence, reset] = ao_fence_v();
    let gen = ((async function * () {
      fence.done = false;
      try {
        for await (let v of _xinvoke$1(ag_out)) {
          reset(v);
          yield v;} }
      finally {
        fence.done = true;
        reset();} }).call(this));

    gen.fence = fence;
    return gen}



  const _ao_split_api ={
    get chain() {
      return fn_chain(this, this)}
  , [Symbol.asyncIterator]: ao_fork
  , ao_fork};

  function ao_split(ag_out) {
    let gen = _ao_tap(ag_out);
    return {
      __proto__: _ao_split_api
    , fin: ao_run(gen)
    , fence: gen.fence} }

  const _as_pipe_end = (g,ns) => _obj_assign(g, ns);

  //~~~
  // Pipe base as generator in composed object-functional implementation

  const _ao_pipe_base ={
    xfold: v => v // on push: identity transform
  , xpull() {} // memory: none
  , xemit: _xinvoke$1 // identity transform or invoke if function
  , xinit(g_in, ag_out) {} // on init: default behavior

  , get create() {
      // as getter to bind class as `this` at access time
      const create = (... args) =>
        _obj_assign({__proto__: this},
          ... args.map(_xinvoke$1))
        ._ao_pipe();

      return create.create = create}

  , _ao_pipe() {
      let fin_lst = [];
      let self ={
        on_fin: g =>(
          fin_lst.push(g)
        , g)

      , stop: (() => {
          this.done = true;
          _fin_pipe(fin_lst);
          this._resume();}) };

      let {kind} = this;
      let g_in = self.on_fin(this._ao_pipe_in(self.stop));
      let ag_out = self.on_fin(this._ao_pipe_out(self.stop));

      self.g_in = g_in = this._as_pipe_in(g_in, self, kind);
      ag_out = this._as_pipe_out(ag_out, self, kind);

      this.xinit(g_in, ag_out);

      // allow g_in to initialize
      g_in.next();
      return ag_out}

  , _as_pipe_in: _as_pipe_end
  , _as_pipe_out: _as_pipe_end

  , //~~~
    // Upstream input generator
    //   designed for multiple feeders

    *_ao_pipe_in(_finish) {
      try {
        let v;
        while (! this.done) {
          v = this.xfold(yield v);
          this.value = v;
          if (0 !== this._waiting && undefined !== v) {
            this._resume();} } }

      finally {
        _finish();} }


  , //~~~
    // Downstream async output generator
    //   designed for single consumer.

    async *_ao_pipe_out(_finish) {
      try {
        let r;
        while (! this.done) {
          if (0 !== (r = this._waiting)) {
            // p0: existing waiters
            r = await r;
            if (this.done) {break} }
          else if (undefined !== (r = this.value)) {
            // p1: available value
            this.value = undefined;}
          else if (undefined !== (r = this.xpull())) {
            }// p2: xpull value (e.g. queue memory) 
          else {
            // p3: add new waiter
            r = await this._bind_waiting();
            if (this.done) {break} }

          yield this.xemit(r);} }

      finally {
        _finish();} }


  , //~~~
    // generator-like value/done states

    value: undefined
  , done: false

  , //~~~
    // promise-based fence tailored for ao_pipe usecase

    _waiting: 0
  , _fulfill() {}
  , async _resume() {
      if (! this.done) {await this;}

      let {value, _fulfill} = this;
      if (undefined != value || this.done) {
        this.value = undefined;
        this._waiting = 0;
        _fulfill(value);} }

  , _bind_waiting() {
      let _reset = y => this._fulfill = y;
      this._bind_waiting = () => this._waiting ||(
        this._waiting = new Promise(_reset));
      return this._bind_waiting()} };


  function _fin_pipe(fin_lst) {
    while (0 !== fin_lst.length) {
      let g = fin_lst.pop();
      try {
        if (_is_fn(g)) {g();}
        else g.return();}
      catch (err) {
        if (err instanceof TypeError) {
          if ('Generator is already running' === err.message) {
            continue} }
        console.error(err);} } }

  const _ao_pipe_in_api ={
    as_pipe_in(self, g_in) {}

  , with_ctx(xctx) {
      if (_is_fn(xctx)) {
        xctx = xctx(this);}

      if (xctx && xctx.next) {
        xctx.next(this);
        this.on_fin(xctx);}
      return xctx}

  , feed(xsrc, xform) {
      return ao_drive(xsrc, this, xform)}

  , bind_vec(... keys) {
      return v => this.next([...keys, v]) }

  , bind_obj(key, ns) {
      return v => this.next({...ns, [key]: v}) } };

  function _ao_pipe_in(g_in, self) {
    return _obj_assign(g_in, _ao_pipe_in_api, self)}

  const _ao_pipe_out_kinds ={
    ao_raw: g => g
  , ao_split: ao_split
  , ao_tap: ao_tap};

  function _ao_pipe_out(ag_out, self, kind) {
    kind = /^ao_/.test(kind) ? kind : 'ao_'+kind;
    let ao_wrap = _ao_pipe_out_kinds[kind];
    if (undefined === ao_wrap) {
      throw new Error(`Unknonwn ao_pipe_out kind "${kind}"`)}

    return _obj_assign(ao_wrap(ag_out), self) }

  const _ao_pipe ={
    __proto__: _ao_pipe_base

  , // xfold: v => v -- on push: identity transform
    // xpull() {} -- memory: none
    // xemit: _xinvoke -- identity transform or invoke if function

    // *xgfold() -- on push: generator-based fold impl
    // *xsrc() -- feed with source generator
    // *xctx(gen_src) -- on init: bind event sources

    kind: 'split'
  , _as_pipe_in: _ao_pipe_in
  , _as_pipe_out: _ao_pipe_out

  , xinit(g_in) {
      let xgfold = this.xgfold;
      if (undefined !== xgfold) {
        this._init_xgfold(g_in, xgfold);}

      this._init_chain(g_in);}


  , _init_xgfold(g_in, xgfold) {
      if (undefined === xgfold) {
        return}

      if (_is_fn(xgfold)) {
        xgfold = xgfold.call(this, this);

        if (_is_fn(xgfold)) {
          this.xfold = xgfold;
          return true}

        xgfold.next();}

      this.xgfold = xgfold;
      this.xfold = this._fold_gen;
      g_in.on_fin(xgfold);
      return true}

  , _fold_gen(v) {
      let {done, value} = this.xgfold.next(v);
      if (done) {this.done = true;}
      return value}


  , _init_chain(g_in) {
      let {xsrc, xctx} = this;
      if (undefined !== xsrc) {
        g_in.feed(xsrc)
          .then (() =>g_in.return()); }

      if (undefined !== xctx) {
        g_in.with_ctx(xctx);} } };


  const ao_pipe = _ao_pipe.create;

  function ao_interval(ms=1000) {
    let [_fence, _reset] = ao_fence_fn();
    let tid = setInterval(_reset, ms, 1);
    if (tid.unref) {tid.unref();}
    _fence.stop = (() => {
      tid = clearInterval(tid);
      _fence.done = true;});
    return _fence}


  function ao_timeout(ms=1000) {
    let tid, [_fence, _reset] = ao_fence_fn(timeout);
    return timeout

    function timeout() {
      tid = setTimeout(_reset, ms, 1);
      if (tid.unref) {tid.unref();}
      return _fence()} }


  async function * ao_times(gen_in) {
    let ts0 = Date.now();
    for await (let v of gen_in) {
      yield Date.now() - ts0;} }

  function ao_dom_animation() {
    let tid, [_fence, _reset] = ao_fence_fn(raf);
    raf.stop = (() => {
      tid = cancelAnimationFrame(tid);
      raf.done = true;});
    return raf

    function raf() {
      tid = requestAnimationFrame(_reset);
      return _fence()} }

  const ao_dom_events =
    _wm_pipe_closure(_ao_dom_events_ctx);

  function _ao_dom_events_ctx(g_in) {
    return {__proto__: _dom_events_api
    , wm_elems: new WeakMap()
    , emit: info => g_in.next(info)} }


  const _dom_events_api ={
    // wm_elems: new WeakMap()
    // emit: info => g_in.next(info)

    listen(elem, evt, xfn, evt_opt) {
      let {emit, info} = this;
       {
        let em = _wm_item(this.wm_elems, elem, _elem_map_entry);
        info ={... info, ... em.info, evt};

        let evt0 = evt.split(/[_.]/, 1)[0];
        if ('init' === evt0) {
          evt_fn(elem);
          return this}

        let old_fn = em.get(evt);

        elem.addEventListener(evt0, evt_fn, evt_opt);
        em.set(evt, evt_fn);

        if (undefined !== old_fn) {
          elem.removeEventListener(evt0, old_fn); }

        if ('message' === evt0 && _is_fn(elem.start)) {
          elem.start();} }

      return this

      function evt_fn(e) {
        let v = xfn(e, emit, info);
        if (undefined !== v) {
          emit({... info, v}); } } }


  , remove(elem, ... keys) {
      let {wm_elems} = this;
      let evt_map = wm_elems.get(elem) || new Map();

      let ev_pairs;
      if (0 === keys.length) {
        wm_elems.delete(elem);
        ev_pairs = evt_map.entries();}

      else {
        ev_pairs = keys.map(
          evt0 => [evt0, evt_map.get(evt0)]); }

      for (let [evt0, evt_fn] of ev_pairs) {
        if (undefined !== evt_fn) {
          evt_map.delete(evt0);
          elem.removeEventListener(evt0, evt_fn);} }
      return this}


  , set_info(el, info) {
      let em = _wm_item(this.wm_elems, el, _elem_map_entry);
      _obj_assign(em.info, info);
      return this}

  , with(... ns_args) {
      let {listen, set_info, info} = this;
      set_info = set_info.bind(this);

      for (let ns of ns_args) {
        let ns_this = undefined === ns.info ? this :
          {__proto__: this, info:{... info, ... ns.info}};

        let events =[... _iter_event_list(ns)];
        for (let elem of _iter_named_elems(ns.$, set_info)) {
          for (let evt_args of events) {
            listen.call(ns_this, elem, ... evt_args);} } }

      return this} };


  function _elem_map_entry(elem) {
    let k = elem.name || elem.id
      || (elem.type || elem.tagName || '').toLowerCase()
      || elem[Symbol.toStringTag];

    let m = new Map();
    m.info ={dom_item: k, k};
    return m}


  function * _iter_named_elems(lst, set_info) {
    lst = _is_array(lst) ? lst
      : lst.addEventListener ? [lst]
      : Object.entries(lst);

    for (let ea of lst) {
      if (_is_array(ea)) {
        set_info(ea[1], {k: ea[0]});
        yield ea[1];}

      else yield ea;} }


  function * _iter_event_list(ns) {
    for (let [attr, efn] of Object.entries(ns)) {
      if (! efn || /[^a-z]/.test(attr)) {
        continue}

      attr = attr.replace('_', '.');
      if ('function' === typeof efn) {
        yield [attr, efn, efn.evt_opt];}

      else if (efn.on_evt || efn.evt_opt) {
        yield [attr, efn.on_evt, efn.evt_opt];} } }

  describe('smoke', (() => {
    it('deferred', (() => {
      is_fn(ao_deferred);
      is_fn(ao_deferred_v); }) );

    it('fence', (() => {
      is_fn(ao_fence_v);
      is_fn(ao_fence_fn);
      is_fn(ao_fence_obj); }) );

    it('drive', (() => {
      is_fn(iter);
      is_fn(step_iter);
      is_fn(ao_iter);
      is_fn(ao_step_iter);

      is_fn(ao_run);
      is_fn(ao_drive); }) );

    it('split', (() => {
      is_fn(ao_split);
      is_fn(ao_tap); }) );

    it('pipe', (() => {
      is_fn(ao_pipe); }) ); }) );

  describe('core ao_deferred', (() => {

    describe('ao_deferred_v tuple', (() => {
      it('shape', (() => {
        const res = ao_deferred_v();
        expect(res).to.be.an('array').of.length(3);
        expect(res[0]).to.be.a('promise');
        expect(res[1]).to.be.a('function');
        expect(res[2]).to.be.a('function');}) );

      it('use, resolve', (async () => {
        const [p, resolve, reject] = ao_deferred_v();

        assert.equal('timeout', await delay_race(p,1));

        resolve('yup');
        assert.equal('yup', await delay_race(p,1)); }) );

      it('use, reject', (async () => {
        const [p, resolve, reject] = ao_deferred_v();

        assert.equal('timeout', await delay_race(p,1));

        reject(new Error('nope'));

        try {
          await p;
          assert.fail();}
        catch (err) {
          assert.equal('nope', err.message); } }) ); }) );



    describe('ao_deferred object', (() => {
      it('shape', (() => {
        const res = ao_deferred();
        expect(res).to.be.an('object');
        expect(res.promise).to.be.a('promise');
        expect(res.resolve).to.be.a('function');
        expect(res.reject).to.be.a('function');}) );

      it('use, resolve', (async () => {
        const res = ao_deferred();
        let p = res.promise;

        assert.equal('timeout', await delay_race(p,1));

        res.resolve('yup');
        assert.equal('yup', await delay_race(p,1)); }) );

      it('use, reject', (async () => {
        const res = ao_deferred();
        let p = res.promise;

        assert.equal('timeout', await delay_race(p,1));

        res.reject(new Error('nope'));

        try {
          await p;
          assert.fail();}
        catch (err) {
          assert.equal('nope', err.message); } }) ); }) ); }) );

  describe('core ao_fence', (() => {
    describe('ao_fence_v tuple', (() => {
      it('shape', (() => {
        const res = ao_fence_v();
        expect(res).to.be.an('array').of.length(2);
        expect(res[0]).to.be.a('function');
        expect(res[1]).to.be.a('function');}) );


      it('basic use', (async () => {
        const [fence, resume] = ao_fence_v();

        const p = fence();
        assert.equal('timeout', await delay_race(p,1));

        resume(1942);
        assert.equal(1942, await delay_race(p,1)); }) );


      it('only first after', (async () => {
        const [fence, resume] = ao_fence_v();
        let f;

        resume('one');
        f = fence();
        resume('two');
        resume('three');

        assert.equal('two', await f);

        resume('four');
        resume('five');
        f = fence();
        resume('six');
        resume('seven');

        assert.equal('six', await f); }) );


      it('never blocked on fence', (async () => {
        const [fence, resume] = ao_fence_v();

        resume('one');
        resume('two');
        resume('three'); }) );


      it('exercise fence', (async () => {
        const [fence, resume] = ao_fence_v();

        let v = 'a';
        expect(v).to.equal('a');

        const p = ((async () => {
          v = 'b';

           {const ans = await fence();
             expect(ans).to.equal('bb');}

          v = 'c';
           {const ans = await fence();
             expect(ans).to.equal('cc');}
          v = 'd';
          return 1942})());

        assert.equal('timeout', await delay_race(p,1));
        expect(v).to.equal('b');

         {
          const p = resume(v+v);
          expect(p).to.be.undefined;}

        expect(v).to.equal('b');
        assert.equal('timeout', await delay_race(p,1));
        expect(v).to.equal('c');

         {
          const p = resume(v+v);
          expect(p).to.be.undefined;}

        expect(v).to.equal('c');
        assert.equal(1942, await delay_race(p,1));
        expect(v).to.equal('d');}) ); }) );


    describe('ao_fence object', (() => {
      it('shape', (() => {
        const res = ao_fence_obj();
        expect(res).to.be.an('object');
        expect(res.fence).to.be.a('function');
        expect(res.reset).to.be.a('function');
        expect(res.ao_fork).to.be.a('function');
        expect(res[Symbol.asyncIterator]).to.be.a('function');}) );


      it('basic use', (async () => {
        const res = ao_fence_obj();

        const p = res.fence();
        assert.equal('timeout', await delay_race(p,1));

        res.reset(1942);
        assert.equal(1942, await delay_race(p,1)); }) );


      it('async iter use', (async () => {
        const res = ao_fence_obj();

        delay().then (() =>res.reset('ready'));

        for await (let v of res) {
          assert.equal('ready', v);
          break} }) );


      it('async iter multi use', (async () => {
        const res = ao_fence_obj();

        let pa = ((async () => {
          for await (let v of res) {
            return `pa ${v}`} })());

        let pb = ((async () => {
          for await (let v of res.ao_fork()) {
            return `pb ${v}`} })());

        let pc = res.fence();

        assert.equal('timeout', await delay_race(pa,1));
        assert.equal('timeout', await delay_race(pb,1));
        assert.equal('timeout', await delay_race(pc,1));

        res.reset('ready');
        assert.equal('pa ready', await delay_race(pa,1));
        assert.equal('pb ready', await delay_race(pb,1));
        assert.equal('ready', await delay_race(pc,1)); }) ); }) ); }) );

  describe('core drive', (() => {

    it('ao_run', (async () => {
      let lst = [];
      let g = delay_walk([1942, 2042, 2142]);
      let p = ao_run(g, v => lst.push(v));

      expect(p).to.be.a("promise");
      assert.deepEqual(await p, undefined);
      assert.deepEqual(lst,[1942, 2042, 2142]); }) );

    it('ao_drive generator', (async () => {
      let lst = [];
      let g_tgt = gen_test(lst);
      g_tgt.next('first');
      g_tgt.next('second');
      let g = delay_walk([1942, 2042, 2142]);
      let p = ao_drive(g, g_tgt, v => ['xe', v]);

      expect(p).to.be.a("promise");
      assert.deepEqual(await p, undefined);
      g_tgt.next('final');

      assert.deepEqual(lst,[
        'second'
      , ['xe', 1942]
      , ['xe', 2042]
      , ['xe', 2142]
      , 'final'] );

      function * gen_test(lst) {
        while (1) {
          let v = yield;
          lst.push(v);} } }) );

    it('ao_drive function', (async () => {
      let lst = [];
      let g = delay_walk([1942, 2042, 2142]);
      let p = ao_drive(g, gen_test, v => ['xe', v]);

      expect(p).to.be.a("promise");
      assert.deepEqual(await p, undefined);

      assert.deepEqual(lst,[
        ['xe', 1942]
      , ['xe', 2042]
      , ['xe', 2142] ] );

      function * gen_test() {
        while (1) {
          let v = yield;
          lst.push(v);} } }) ); }) );

  describe('core drive iters', (() => {

    it('normal iter', (() => {
      let g = is_gen(iter([10, 20, 30]));
      assert.deepEqual({value: 10, done: false}, g.next()); }) );


    it('async iter', (async () => {
      let g = is_gen(ao_iter([10, 20, 30]));

      let p = g.next();
      expect(p).to.be.a('promise');

      assert.deepEqual({value: 10, done: false}, await p); }) );


    it('normal step_iter', (() => {
      let z = Array.from(
        zip(
          [10, 20, 30]
        , ['a', 'b', 'c']) );

      assert.deepEqual(z,[
        [10, 'a']
      , [20, 'b']
      , [30, 'c']] );

      function * zip(a, b) {
        b = step_iter(b);
        for (let av of iter(a)) {
          for (let bv of b) {
            yield [av, bv];} } } }) );


    it('async ao_step_iter', (async () => {
      let z = await array_from_ao_iter(
        ao_zip(
          [10, 20, 30]
        , ['a', 'b', 'c']) );

      assert.deepEqual(z,[
        [10, 'a']
      , [20, 'b']
      , [30, 'c']] );


      async function * ao_zip(a, b) {
        b = ao_step_iter(b);
        for await (let av of ao_iter(a)) {
          for await (let bv of b) {
            yield [av, bv];} } } }) ); }) );

  describe('core split', (() => {

    describe('ao_split', (() => {
      it('triple', (async () => {
        let g = delay_walk([1942, 2042, 2142]);
        let gs = is_async_iterable(ao_split(g));

        expect(gs.fin).to.be.a('promise');
        expect(gs.fence).to.be.a('function');

        let p = gs.fence();
        expect(p).to.be.a('promise');

        let a = array_from_ao_iter(gs);
        expect(a).to.be.a('promise');
        let b = array_from_ao_iter(gs);
        expect(b).to.be.a('promise');
        let c = array_from_ao_iter(gs.ao_fork());
        expect(c).to.be.a('promise');

        assert.equal(await p, 1942);

        p = gs.fence();
        assert.equal(await p, 2042);

        p = gs.fence();
        assert.equal(await p, 2142);

        await gs.fin;
        assert.deepEqual(a = await a,[1942, 2042, 2142]);
        assert.deepEqual(b = await b,[1942, 2042, 2142]);
        assert.deepEqual(c = await c,[1942, 2042, 2142]);

        assert(a !== b);
        assert(a !== c);
        assert(b !== c); }) ); }) );


    describe('ao_tap', (() => {
      it('triple', (async () => {
        let g = delay_walk([1942, 2042, 2142]);
        let gs = is_async_iterable(ao_tap(g));

        expect(gs.fence).to.be.a('function');

        let p = gs.fence();
        expect(p).to.be.a('promise');

        let a = array_from_ao_iter(gs.ao_fork());
        expect(a).to.be.a('promise');
        let b = array_from_ao_iter(gs.ao_fork());
        expect(b).to.be.a('promise');
        let c = array_from_ao_iter(gs.ao_fork());
        expect(c).to.be.a('promise');

        assert.equal('timeout', await delay_race(p,1));
        let z = array_from_ao_iter(gs);

        assert.equal(await p, 1942);

        assert.deepEqual(a = await a,[1942, 2042, 2142]);
        assert.deepEqual(b = await b,[1942, 2042, 2142]);
        assert.deepEqual(c = await c,[1942, 2042, 2142]);

        assert(a !== b);
        assert(a !== c);
        assert(b !== c); }) ); }) ); }) );

  describe('core _ao_pipe_base', (() => {
    it('shape', (() => {
      let pipe = is_async_iterable(_ao_pipe_base.create());
      is_gen(pipe.g_in); }) );


    it('example', (async () => {
      let pipe = _ao_pipe_base.create();
      let z = common_ao_pipe_base(pipe,
        [1942, 2042, 2142]);

      assert.deepEqual(
        [1942, 2042, 2142]
      , await delay_race(z, 50)); }) );

    it('xfold', (async () => {
      let pipe = _ao_pipe_base.create (() => {
        let s = 0;
        return {xfold: v => s += v} });

      let z = common_ao_pipe_base(pipe,
        [1942, 2042, 2142]);

      assert.deepEqual(
        [1942, 1942+2042, 1942+2042+2142]
      , await delay_race(z, 50)); }) );


    it('xemit', (async () => {
      let pipe = _ao_pipe_base.create({
        xemit: v => ['xe', v]});

      let z = common_ao_pipe_base(pipe,
        [1942, 2042, 2142]);

      assert.deepEqual(
        [['xe', 1942]
          , ['xe', 2042]
          , ['xe', 2142]]
      , await delay_race(z, 50)); }) );


    it('xpull', (async () => {
      let pipe = _ao_pipe_base.create (() => {
        let mem = [];
        return {
          xfold(v) {
            if (undefined !== v) {
              mem.push(v);}
            return mem[0]}
        , xpull() {
            return mem[0]}
        , xemit() {
            let tip = mem.shift();
            let q = mem.slice();
            return {tip, q} } } });

      let z = array_from_ao_iter(pipe);
      for (let v of [1942, 2042, 2142]) {
        pipe.g_in.next(v);}

      await delay(1);
      pipe.g_in.return();

      assert.deepEqual(
        [
          {tip: 1942, q:[2042, 2142]}
        , {tip: 2042, q:[2142]}
        , {tip: 2142, q:[] } ]
      , await z); }) );


    async function common_ao_pipe_base(pipe, values) {
      let z = array_from_ao_iter(pipe);

      await ao_drive(
        delay_walk(values)
      , pipe.g_in);

      pipe.g_in.return();

      return z} }) );

  describe('core ao_pipe', function() {
    it('shape', (() => {
      let pipe = is_async_iterable(ao_pipe());
      is_gen(pipe.g_in); }) );


    describe('compute', (() => {
      it('xfold', (async () => {
        let pipe = ao_pipe({
          xsrc: delay_walk([30,20,10])
        , xfold: v => 1000 + v});

        let z = array_from_ao_iter(pipe);
        assert.deepEqual(await z,[1030, 1020, 1010]); }) );


      it('*xgfold', (async () => {
        let pipe = ao_pipe({
          xsrc: delay_walk([30,20,10])
        , *xgfold() {
            let s = 0;
            while (1) {
              let v = yield s;
              s += v + 1000;} } });

        let z = array_from_ao_iter(pipe);
        assert.deepEqual(await z,[1030, 2050, 3060]); }) );


      it('xsrc', (async () => {
        let pipe = ao_pipe({
          xsrc: delay_walk([30,20,10]) });

        let z = array_from_ao_iter(pipe);
        assert.deepEqual(await z,[30,20,10]); }) );


      it('xctx', (async () => {
        let log=[];

        let pipe = ao_pipe({
          *xctx(g_in) {
            log.push('xctx start');
            let tid = setTimeout(
              v => g_in.next(v)
            , 1, 'bingo');

            try {yield;}
            finally {
              clearTimeout(tid);
              log.push('xctx fin'); } } });

        let z = array_from_ao_iter(pipe);

        assert.deepEqual(log,['xctx start']);

        await delay(5);
        pipe.stop();

        assert.deepEqual(log,['xctx start', 'xctx fin']);

        assert.deepEqual(await z,['bingo']); }) ); }) );


    describe('g_in: source generator feed', (() => {
      it('with', (async () => {
        let log=[];

        let pipe = ao_pipe();

        pipe.g_in.with_ctx ((function * ( g_in ) {
          log.push('g_in.with start');
          let tid = setTimeout(
            v => g_in.next(v)
          , 1, 'bingo');

          try {yield;}
          finally {
            clearTimeout(tid);
            log.push('g_in.with fin'); } }).bind(this));

        let z = array_from_ao_iter(pipe);

        assert.deepEqual(log,['g_in.with start']);

        await delay(5);
        pipe.stop();

        assert.deepEqual(log,['g_in.with start', 'g_in.with fin']);

        assert.deepEqual(await z,['bingo']); }) );


      it('feed', (async () => {
        let pipe = ao_pipe();
        let z = array_from_ao_iter(pipe);

        await pipe.g_in.feed(
          delay_walk([1942, 2042, 2142]) );

        pipe.stop();
        assert.deepEqual(await z,[1942, 2042, 2142]); }) );


      it('bind_vec', (async () => {
        let pipe = ao_pipe();
        let z = ao_iter(pipe).next();
        let send = pipe.g_in.bind_vec('a', 'b', 'c');
        send('bind_vec');

        z = await z;
        assert.deepEqual(z.value,
          ['a', 'b', 'c', 'bind_vec'] ); }) );


      it('bind_obj', (async () => {
        let pipe = ao_pipe();
        let z = ao_iter(pipe).next();
        let send = pipe.g_in.bind_obj('zed',{
          a: 'aaa', b: 'bbb'} );

        send('bind_obj');
        z = await z;
        assert.deepEqual(z.value,
          {a:'aaa', b:'bbb', zed: 'bind_obj'} ); }) ); }) );


    describe('output async generator', (() => {
      it('raw', (async () => {
        let gs = is_gen(
          ao_pipe({
            xsrc: delay_walk([30,20,10])
          , kind: 'raw'}) );

        let v0 = gs.next();
        expect(v0).to.be.a('promise');

        let p = ao_run(gs);
        expect(p).to.be.a('promise');
        expect(await p).to.be.undefined;

        let v1 = gs.next();
        expect(v1).to.be.a('promise');

        expect(await v0).to.deep.equal({value: 30, done: false});
        expect(await v1).to.deep.equal({value: undefined, done: true}); }) );


      it('tap', (async () => {
        let gs = is_async_iterable(
          ao_pipe({
            xsrc: delay_walk([30, 20, 10])
          , kind: 'tap'}) );

        let a = array_from_ao_iter(gs.ao_fork());
        let b = array_from_ao_iter(gs.ao_fork());

        let z = array_from_ao_iter(gs);
        expect(gs.fence).to.be.a('function');

        expect(a).to.be.a('promise');
        expect(b).to.be.a('promise');
        expect(z).to.be.a('promise');

        let p = gs.fence();
        expect(p).to.be.a('promise');
        expect(await p).to.equal(30);

        expect(await z).to.deep.equal([30, 20, 10]);
        expect(await a).to.deep.equal([30, 20, 10]);
        expect(await b).to.deep.equal([30, 20, 10]); }) );


      it('split', (async () => {
        let gs = is_async_iterable(
          ao_pipe({
            xsrc: delay_walk([30, 20, 10])
          , kind: 'split'}) );

        let a = array_from_ao_iter(gs);
        let b = array_from_ao_iter(gs.ao_fork());
        let z = array_from_ao_iter(gs);

        expect(gs.fence).to.be.a('function');
        expect(gs.fin).to.be.a('promise');

        expect(a).to.be.a('promise');
        expect(b).to.be.a('promise');
        expect(z).to.be.a('promise');

        let p = gs.fence();
        expect(p).to.be.a('promise');
        expect(await p).to.equal(30);

        expect(await z).to.deep.equal([30, 20, 10]);
        expect(await a).to.deep.equal([30, 20, 10]);
        expect(await b).to.deep.equal([30, 20, 10]); }) ); }) ); } );

  describe('time', (() => {
    it('shape', (() => {
      is_fn(ao_interval);
      is_fn(ao_timeout);
      is_fn(ao_times); }) );

    it('ao_interval', (async () => {
      let aot = is_async_iterable(ao_interval(10));
      let g = ao_iter(aot);

      try {
        let p = g.next();
        expect(p).to.be.a('promise');

        let {value} = await p;
        assert.equal(1, value);}

      finally {
        g.return();} }) );

    it('ao_timeout', (async () => {
      let aot = is_async_iterable(ao_timeout(10));
      let g = ao_iter(aot);

      try {
        let p = g.next();
        expect(p).to.be.a('promise');

        let {value} = await p;
        assert.equal(1, value);}

      finally {
        g.return();} }) );

    it('ao_times', (async () => {
      let g = is_gen(ao_times(ao_interval(10)));

      try {
        let p = g.next();
        expect(p).to.be.a('promise');

        let {value: ts1} = await p;
        assert(ts1 >= 0);

        let {value: ts2} = await g.next();
        assert(ts2 >= ts1);}

      finally {
        g.return();} }) ); }) );

  describe('dom events', (() => {
    it('shape', (() => {
      is_fn(ao_dom_events);

      let de = ao_dom_events(ao_pipe());
      is_fn(de.listen);
      is_fn(de.remove);
      is_fn(de.set_info);
      is_fn(de.with); }) );

    if ('undefined' !== typeof MessageChannel) {

      it('message channels', (async () => {
        const {port1, port2} = new MessageChannel();

        const ao_tgt = ao_pipe();
        let z = array_from_ao_iter(ao_tgt);

        ao_dom_events(ao_tgt).with({
          $:{test_name: port2}
        , message: evt => evt.data});

        {(async ()=>{
          for (let m of ['a', 'b', 'c']) {
            port1.postMessage(`from msg port1: ${m}`);
            await delay(1);}

          ao_tgt.g_in.stop();})();}


        let expected =[
          {dom_item: 'MessagePort'
            , evt: 'message'
            , k: 'test_name'
            , v: 'from msg port1: a'}

        , {dom_item: 'MessagePort'
            , evt: 'message'
            , k: 'test_name'
            , v: 'from msg port1: b'}

        , {dom_item: 'MessagePort'
            , evt: 'message'
            , k: 'test_name'
            , v: 'from msg port1: c'} ];

        expect(await z).to.deep.equal(expected);}) ); } }) );

  describe('dom animation frames', (() => {
    it('shape', (() => {
      is_fn(ao_dom_animation); }) );

    if ('undefined' !== typeof requestAnimationFrame) {

      it('ao_dom_animation', (async () => {
        let aot = is_async_iterable(ao_dom_animation());
        let g = ao_iter(aot);

        try {
          let p = g.next();
          expect(p).to.be.a('promise');

          let {value} = await p;
          assert(value >= 0);}

        finally {
          g.return();} }) );

      it('ao_times', (async () => {
        let g = is_gen(ao_times(ao_dom_animation()));

        try {
          let p = g.next();
          expect(p).to.be.a('promise');

          let {value: ts1} = await p;
          assert(ts1 >= 0);

          let {value: ts2} = await g.next();
          assert(ts2 >= ts1);}

        finally {
          g.return();} }) ); } }) );

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pdHRlc3QuanMiLCJzb3VyY2VzIjpbIi4uL3VuaXQvX3V0aWxzLmpzeSIsIi4uLy4uL2VzbS9yb2FwLm1qcyIsIi4uL3VuaXQvc21va2UuanN5IiwiLi4vdW5pdC9jb3JlX2RlZmVycmVkLmpzeSIsIi4uL3VuaXQvY29yZV9mZW5jZS5qc3kiLCIuLi91bml0L2NvcmVfZHJpdmUuanN5IiwiLi4vdW5pdC9jb3JlX2RyaXZlX2l0ZXJzLmpzeSIsIi4uL3VuaXQvY29yZV9zcGxpdC5qc3kiLCIuLi91bml0L2NvcmVfcGlwZV9iYXNlLmpzeSIsIi4uL3VuaXQvY29yZV9waXBlLmpzeSIsIi4uL3VuaXQvdGltZS5qc3kiLCIuLi91bml0L2RvbV9ldmVudHMuanN5IiwiLi4vdW5pdC9kb21fYW5pbS5qc3kiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgeyBhc3NlcnQsIGV4cGVjdCB9ID0gcmVxdWlyZSgnY2hhaScpXG5leHBvcnQgQHt9IGFzc2VydCwgZXhwZWN0XG5cbmV4cG9ydCBjb25zdCBkZWxheSA9IChtcz0xKSA9PiBcbiAgbmV3IFByb21pc2UgQCB5ID0+XG4gICAgc2V0VGltZW91dCBAIHksIG1zLCAndGltZW91dCdcblxuZXhwb3J0IGNvbnN0IGRlbGF5X3JhY2UgPSAocCwgbXM9MSkgPT4gXG4gIFByb21pc2UucmFjZSBAIyBwLCBkZWxheShtcylcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uICogZGVsYXlfd2FsayhnX2luLCBtcz0xKSA6OlxuICBhd2FpdCBkZWxheShtcylcbiAgZm9yIGF3YWl0IGxldCB2IG9mIGdfaW4gOjpcbiAgICB5aWVsZCB2XG4gICAgYXdhaXQgZGVsYXkobXMpXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19mbihmbikgOjpcbiAgYXNzZXJ0LmVxdWFsIEAgJ2Z1bmN0aW9uJywgdHlwZW9mIGZuXG4gIHJldHVybiBmblxuXG5leHBvcnQgZnVuY3Rpb24gaXNfZ2VuKGcpIDo6XG4gIGlzX2ZuKGcubmV4dClcbiAgaXNfZm4oZy5yZXR1cm4pXG4gIGlzX2ZuKGcudGhyb3cpXG4gIHJldHVybiBnXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19hc3luY19pdGVyYWJsZShvKSA6OlxuICBhc3NlcnQgQCBudWxsICE9IG9bU3ltYm9sLmFzeW5jSXRlcmF0b3JdLCAnYXN5bmMgaXRlcmFibGUnXG4gIHJldHVybiBvXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhcnJheV9mcm9tX2FvX2l0ZXIoZykgOjpcbiAgbGV0IHJlcyA9IFtdXG4gIGZvciBhd2FpdCBsZXQgdiBvZiBnIDo6XG4gICAgcmVzLnB1c2godilcbiAgcmV0dXJuIHJlc1xuXG4iLCJjb25zdCB7XG4gIGFzc2lnbjogX29ial9hc3NpZ24sXG4gIGRlZmluZVByb3BlcnRpZXM6IF9vYmpfcHJvcHMsXG59ID0gT2JqZWN0O1xuXG5jb25zdCB7XG4gIGlzQXJyYXk6IF9pc19hcnJheSxcbn0gPSBBcnJheTtcblxuY29uc3QgaXNfYW9faXRlciA9IGcgPT5cbiAgbnVsbCAhPSBnW1N5bWJvbC5hc3luY0l0ZXJhdG9yXTtcblxuY29uc3QgX2lzX2ZuID0gdl9mbiA9PlxuICAnZnVuY3Rpb24nID09PSB0eXBlb2Ygdl9mblxuICAgICYmICEgaXNfYW9faXRlcih2X2ZuKTtcbmNvbnN0IF9yZXRfaWRlbnQgPSB2ID0+IHY7XG5cbmNvbnN0IF94aW52b2tlJDEgPSB2X2ZuID0+XG4gIF9pc19mbih2X2ZuKVxuICAgID8gdl9mbigpXG4gICAgOiB2X2ZuO1xuXG5mdW5jdGlvbiBfeHBpcGVfdGd0KHBpcGUpIHtcbiAgaWYgKF9pc19mbihwaXBlKSkge1xuICAgIHBpcGUgPSBwaXBlKCk7XG4gICAgcGlwZS5uZXh0KCk7XG4gICAgcmV0dXJuIHBpcGV9XG5cbiAgcmV0dXJuIHBpcGUuZ19pbiB8fCBwaXBlfVxuXG5mdW5jdGlvbiAqIGl0ZXIoZ2VuX2luKSB7XG4gIHlpZWxkICogX3hpbnZva2UkMShnZW5faW4pO31cblxuYXN5bmMgZnVuY3Rpb24gKiBhb19pdGVyKGdlbl9pbikge1xuICB5aWVsZCAqIF94aW52b2tlJDEoZ2VuX2luKTt9XG5cblxuZnVuY3Rpb24gZm5fY2hhaW4odGFpbCwgY3R4KSB7XG4gIHJldHVybiBfb2JqX2Fzc2lnbihjaGFpbix7XG4gICAgY2hhaW4sIHRhaWw6IF94aW52b2tlJDEodGFpbCl9IClcblxuICBmdW5jdGlvbiBjaGFpbihmbikge1xuICAgIGNoYWluLnRhaWwgPSBmbihjaGFpbi50YWlsLCBjdHgpO1xuICAgIHJldHVybiBjaGFpbn0gfVxuXG5cbmZ1bmN0aW9uIF93bV9waXBlX2Nsb3N1cmUod21fYWJzZW50KSB7XG4gIGxldCB3bSA9IG5ldyBXZWFrTWFwKCk7XG4gIHJldHVybiBwaXBlID0+XG4gICAgX3dtX2l0ZW0od20sXG4gICAgICBwaXBlLmdfaW4gfHwgcGlwZSxcbiAgICAgIHdtX2Fic2VudCkgfVxuXG5mdW5jdGlvbiBfd21fY2xvc3VyZSh3bV9hYnNlbnQpIHtcbiAgbGV0IHdtID0gbmV3IFdlYWtNYXAoKTtcbiAgcmV0dXJuIGtleSA9PlxuICAgIF93bV9pdGVtKHdtLFxuICAgICAga2V5LCB3bV9hYnNlbnQpIH1cblxuZnVuY3Rpb24gX3dtX2l0ZW0od20sIHdtX2tleSwgd21fYWJzZW50KSB7XG4gIGxldCBpdGVtID0gd20uZ2V0KHdtX2tleSk7XG4gIGlmICh1bmRlZmluZWQgPT09IGl0ZW0pIHtcbiAgICBpdGVtID0gd21fYWJzZW50KHdtX2tleSk7XG4gICAgd20uc2V0KHdtX2tleSwgaXRlbSk7fVxuICByZXR1cm4gaXRlbX1cblxuY29uc3QgYW9fZGVmZXJyZWRfdiA9ICgoKCkgPT4ge1xuICBsZXQgeSxuLF9wc2V0ID0gKGEsYikgPT4geyB5PWEsIG49YjsgfTtcbiAgcmV0dXJuIHAgPT4oXG4gICAgcCA9IG5ldyBQcm9taXNlKF9wc2V0KVxuICAsIFtwLCB5LCBuXSkgfSkoKSk7XG5cbmNvbnN0IGFvX2RlZmVycmVkID0gdiA9PihcbiAgdiA9IGFvX2RlZmVycmVkX3YoKVxuLCB7cHJvbWlzZTogdlswXSwgcmVzb2x2ZTogdlsxXSwgcmVqZWN0OiB2WzJdfSk7XG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX3YoKSB7XG4gIGxldCBwPTAsIF9yZXN1bWUgPSAoKT0+e307XG4gIGxldCBfcHNldCA9IGEgPT4gX3Jlc3VtZSA9IGE7XG5cbiAgcmV0dXJuIFtcbiAgICAoKSA9PiAwICE9PSBwID8gcFxuICAgICAgOiBwID0gbmV3IFByb21pc2UoX3BzZXQpXG5cbiAgLCB2ID0+IHtwID0gMDsgX3Jlc3VtZSh2KTt9IF0gfVxuXG5cbmNvbnN0IF9hb19mZW5jZV9hcGkgPXtcbiAgc3RvcCgpIHt0aGlzLmZlbmNlLmRvbmUgPSB0cnVlO31cblxuLCBhb19mb3JrKCkge1xuICAgIHJldHVybiBhb19mZW5jZV9mb3JrKHRoaXMuZmVuY2UpfVxuXG4sIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgcmV0dXJuIHRoaXMuYW9fZm9yaygpfSB9O1xuXG5mdW5jdGlvbiBhb19mZW5jZV9mbih0Z3QpIHtcbiAgbGV0IGYgPSBhb19mZW5jZV92KCk7XG4gIGlmICh1bmRlZmluZWQgPT09IHRndCkge3RndCA9IGZbMF07fVxuICB0Z3QuZmVuY2UgPSBfb2JqX2Fzc2lnbih0Z3QsIF9hb19mZW5jZV9hcGkpO1xuICByZXR1cm4gZn1cblxuZnVuY3Rpb24gYW9fZmVuY2Vfb2JqKHRndCkge1xuICBsZXQgZiA9IGFvX2ZlbmNlX2ZuKHRndCk7XG4gIHJldHVybiB7X19wcm90b19fOiBfYW9fZmVuY2VfYXBpXG4gICwgZmVuY2U6IHRndCB8fCBmWzBdLCByZXNldDogZlsxXX0gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9fZmVuY2VfZm9yayhmZW5jZSkge1xuICB3aGlsZSAoISBmZW5jZS5kb25lKSB7XG4gICAgbGV0IHYgPSBhd2FpdCBmZW5jZSgpO1xuICAgIGlmIChmZW5jZS5kb25lKSB7XG4gICAgICByZXR1cm4gdn1cbiAgICB5aWVsZCB2O30gfVxuXG5cbi8vIGV4cG9ydCBhc3luYyBmdW5jdGlvbiAqIGFvX2ZlbmNlX21hcmtzKGZlbmNlLCBvcHQpIDo6XG4vLyAgIGxldCB7c2lnbmFsLCB0cmFpbGluZywgaW5pdGlhbH0gPSBvcHQgfHwge31cbi8vICAgbGV0IGYgPSB0cnVlID09PSBpbml0aWFsXG4vLyAgICAgPyBmZW5jZSgpIDogaW5pdGlhbFxuLy9cbi8vICAgd2hpbGUgISBmZW5jZS5kb25lIDo6XG4vLyAgICAgbGV0IHZcbi8vICAgICBpZiB0cmFpbGluZyA6OlxuLy8gICAgICAgdiA9IGF3YWl0IGZcbi8vICAgICAgIGYgPSBmZW5jZSgpXG4vL1xuLy8gICAgIGVsc2UgOjpcbi8vICAgICAgIGYgPSBmZW5jZSgpXG4vLyAgICAgICB2ID0gYXdhaXQgZlxuLy9cbi8vICAgICBpZiBmZW5jZS5kb25lIDo6XG4vLyAgICAgICByZXR1cm4gdlxuLy9cbi8vICAgICBpZiBfaXNfZm4oc2lnbmFsKSA6OlxuLy8gICAgICAgeWllbGQgc2lnbmFsKHYpXG4vLyAgICAgZWxzZSBpZiBzaWduYWwgOjpcbi8vICAgICAgIHlpZWxkIHNpZ25hbFxuLy8gICAgIGVsc2UgeWllbGQgdlxuXG5hc3luYyBmdW5jdGlvbiBhb19ydW4oZ2VuX2luLCBub3RpZnk9X3JldF9pZGVudCkge1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIF94aW52b2tlJDEoZ2VuX2luKSkge1xuICAgIG5vdGlmeSh2KTt9IH1cblxuXG5hc3luYyBmdW5jdGlvbiBhb19kcml2ZShnZW5faW4sIGdlbl90Z3QsIHhmb3JtPV9yZXRfaWRlbnQpIHtcbiAgZ2VuX3RndCA9IF94cGlwZV90Z3QoZ2VuX3RndCk7XG4gIGZvciBhd2FpdCAobGV0IHYgb2YgX3hpbnZva2UkMShnZW5faW4pKSB7XG4gICAgaWYgKHVuZGVmaW5lZCAhPT0gZ2VuX3RndCkge1xuICAgICAgdiA9IHhmb3JtKHYpO1xuICAgICAgbGV0IHtkb25lfSA9IGF3YWl0IGdlbl90Z3QubmV4dCh2KTtcbiAgICAgIGlmIChkb25lKSB7YnJlYWt9IH0gfSB9XG5cblxuZnVuY3Rpb24gYW9fc3RlcF9pdGVyKGl0ZXJhYmxlLCBtdWx0aXBsZSkge1xuICBpdGVyYWJsZSA9IGFvX2l0ZXIoaXRlcmFibGUpO1xuICByZXR1cm4ge1xuICAgIGFzeW5jICogW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBpdGVyYWJsZS5uZXh0KCk7XG4gICAgICAgIHlpZWxkIHZhbHVlO31cbiAgICAgIHdoaWxlIChtdWx0aXBsZSkgfSB9IH1cblxuXG5mdW5jdGlvbiBzdGVwX2l0ZXIoaXRlcmFibGUsIG11bHRpcGxlKSB7XG4gIGl0ZXJhYmxlID0gaXRlcihpdGVyYWJsZSk7XG4gIHJldHVybiB7XG4gICAgKltTeW1ib2wuaXRlcmF0b3JdKCkge1xuICAgICAgZG8ge1xuICAgICAgICBsZXQge3ZhbHVlfSA9IGl0ZXJhYmxlLm5leHQoKTtcbiAgICAgICAgeWllbGQgdmFsdWU7fVxuICAgICAgd2hpbGUgKG11bHRpcGxlKSB9IH0gfVxuXG5mdW5jdGlvbiBhb19mb3JrKCkge1xuICByZXR1cm4gYW9fZmVuY2VfZm9yayh0aGlzLmZlbmNlKX1cblxuY29uc3QgX2FvX3RhcF9wcm9wcyA9e1xuICBhb19mb3JrOnt2YWx1ZTogYW9fZm9ya31cbiwgY2hhaW46e2dldCgpIHtcbiAgICByZXR1cm4gZm5fY2hhaW4odGhpcywgdGhpcyl9IH0gfTtcblxuZnVuY3Rpb24gYW9fdGFwKGFnX291dCkge1xuICByZXR1cm4gX29ial9wcm9wcyhfYW9fdGFwKGFnX291dCksIF9hb190YXBfcHJvcHMpIH1cblxuZnVuY3Rpb24gX2FvX3RhcChhZ19vdXQpIHtcbiAgbGV0IFtmZW5jZSwgcmVzZXRdID0gYW9fZmVuY2VfdigpO1xuICBsZXQgZ2VuID0gKChhc3luYyBmdW5jdGlvbiAqICgpIHtcbiAgICBmZW5jZS5kb25lID0gZmFsc2U7XG4gICAgdHJ5IHtcbiAgICAgIGZvciBhd2FpdCAobGV0IHYgb2YgX3hpbnZva2UkMShhZ19vdXQpKSB7XG4gICAgICAgIHJlc2V0KHYpO1xuICAgICAgICB5aWVsZCB2O30gfVxuICAgIGZpbmFsbHkge1xuICAgICAgZmVuY2UuZG9uZSA9IHRydWU7XG4gICAgICByZXNldCgpO30gfSkuY2FsbCh0aGlzKSk7XG5cbiAgZ2VuLmZlbmNlID0gZmVuY2U7XG4gIHJldHVybiBnZW59XG5cblxuXG5jb25zdCBfYW9fc3BsaXRfYXBpID17XG4gIGdldCBjaGFpbigpIHtcbiAgICByZXR1cm4gZm5fY2hhaW4odGhpcywgdGhpcyl9XG4sIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl06IGFvX2ZvcmtcbiwgYW9fZm9ya307XG5cbmZ1bmN0aW9uIGFvX3NwbGl0KGFnX291dCkge1xuICBsZXQgZ2VuID0gX2FvX3RhcChhZ19vdXQpO1xuICByZXR1cm4ge1xuICAgIF9fcHJvdG9fXzogX2FvX3NwbGl0X2FwaVxuICAsIGZpbjogYW9fcnVuKGdlbilcbiAgLCBmZW5jZTogZ2VuLmZlbmNlfSB9XG5cbmNvbnN0IF9hc19waXBlX2VuZCA9IChnLG5zKSA9PiBfb2JqX2Fzc2lnbihnLCBucyk7XG5cbi8vfn5+XG4vLyBQaXBlIGJhc2UgYXMgZ2VuZXJhdG9yIGluIGNvbXBvc2VkIG9iamVjdC1mdW5jdGlvbmFsIGltcGxlbWVudGF0aW9uXG5cbmNvbnN0IF9hb19waXBlX2Jhc2UgPXtcbiAgeGZvbGQ6IHYgPT4gdiAvLyBvbiBwdXNoOiBpZGVudGl0eSB0cmFuc2Zvcm1cbiwgeHB1bGwoKSB7fSAvLyBtZW1vcnk6IG5vbmVcbiwgeGVtaXQ6IF94aW52b2tlJDEgLy8gaWRlbnRpdHkgdHJhbnNmb3JtIG9yIGludm9rZSBpZiBmdW5jdGlvblxuLCB4aW5pdChnX2luLCBhZ19vdXQpIHt9IC8vIG9uIGluaXQ6IGRlZmF1bHQgYmVoYXZpb3JcblxuLCBnZXQgY3JlYXRlKCkge1xuICAgIC8vIGFzIGdldHRlciB0byBiaW5kIGNsYXNzIGFzIGB0aGlzYCBhdCBhY2Nlc3MgdGltZVxuICAgIGNvbnN0IGNyZWF0ZSA9ICguLi4gYXJncykgPT5cbiAgICAgIF9vYmpfYXNzaWduKHtfX3Byb3RvX186IHRoaXN9LFxuICAgICAgICAuLi4gYXJncy5tYXAoX3hpbnZva2UkMSkpXG4gICAgICAuX2FvX3BpcGUoKTtcblxuICAgIHJldHVybiBjcmVhdGUuY3JlYXRlID0gY3JlYXRlfVxuXG4sIF9hb19waXBlKCkge1xuICAgIGxldCBmaW5fbHN0ID0gW107XG4gICAgbGV0IHNlbGYgPXtcbiAgICAgIG9uX2ZpbjogZyA9PihcbiAgICAgICAgZmluX2xzdC5wdXNoKGcpXG4gICAgICAsIGcpXG5cbiAgICAsIHN0b3A6ICgoKSA9PiB7XG4gICAgICAgIHRoaXMuZG9uZSA9IHRydWU7XG4gICAgICAgIF9maW5fcGlwZShmaW5fbHN0KTtcbiAgICAgICAgdGhpcy5fcmVzdW1lKCk7fSkgfTtcblxuICAgIGxldCB7a2luZH0gPSB0aGlzO1xuICAgIGxldCBnX2luID0gc2VsZi5vbl9maW4odGhpcy5fYW9fcGlwZV9pbihzZWxmLnN0b3ApKTtcbiAgICBsZXQgYWdfb3V0ID0gc2VsZi5vbl9maW4odGhpcy5fYW9fcGlwZV9vdXQoc2VsZi5zdG9wKSk7XG5cbiAgICBzZWxmLmdfaW4gPSBnX2luID0gdGhpcy5fYXNfcGlwZV9pbihnX2luLCBzZWxmLCBraW5kKTtcbiAgICBhZ19vdXQgPSB0aGlzLl9hc19waXBlX291dChhZ19vdXQsIHNlbGYsIGtpbmQpO1xuXG4gICAgdGhpcy54aW5pdChnX2luLCBhZ19vdXQpO1xuXG4gICAgLy8gYWxsb3cgZ19pbiB0byBpbml0aWFsaXplXG4gICAgZ19pbi5uZXh0KCk7XG4gICAgcmV0dXJuIGFnX291dH1cblxuLCBfYXNfcGlwZV9pbjogX2FzX3BpcGVfZW5kXG4sIF9hc19waXBlX291dDogX2FzX3BpcGVfZW5kXG5cbiwgLy9+fn5cbiAgLy8gVXBzdHJlYW0gaW5wdXQgZ2VuZXJhdG9yXG4gIC8vICAgZGVzaWduZWQgZm9yIG11bHRpcGxlIGZlZWRlcnNcblxuICAqX2FvX3BpcGVfaW4oX2ZpbmlzaCkge1xuICAgIHRyeSB7XG4gICAgICBsZXQgdjtcbiAgICAgIHdoaWxlICghIHRoaXMuZG9uZSkge1xuICAgICAgICB2ID0gdGhpcy54Zm9sZCh5aWVsZCB2KTtcbiAgICAgICAgdGhpcy52YWx1ZSA9IHY7XG4gICAgICAgIGlmICgwICE9PSB0aGlzLl93YWl0aW5nICYmIHVuZGVmaW5lZCAhPT0gdikge1xuICAgICAgICAgIHRoaXMuX3Jlc3VtZSgpO30gfSB9XG5cbiAgICBmaW5hbGx5IHtcbiAgICAgIF9maW5pc2goKTt9IH1cblxuXG4sIC8vfn5+XG4gIC8vIERvd25zdHJlYW0gYXN5bmMgb3V0cHV0IGdlbmVyYXRvclxuICAvLyAgIGRlc2lnbmVkIGZvciBzaW5nbGUgY29uc3VtZXIuXG5cbiAgYXN5bmMgKl9hb19waXBlX291dChfZmluaXNoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCByO1xuICAgICAgd2hpbGUgKCEgdGhpcy5kb25lKSB7XG4gICAgICAgIGlmICgwICE9PSAociA9IHRoaXMuX3dhaXRpbmcpKSB7XG4gICAgICAgICAgLy8gcDA6IGV4aXN0aW5nIHdhaXRlcnNcbiAgICAgICAgICByID0gYXdhaXQgcjtcbiAgICAgICAgICBpZiAodGhpcy5kb25lKSB7YnJlYWt9IH1cbiAgICAgICAgZWxzZSBpZiAodW5kZWZpbmVkICE9PSAociA9IHRoaXMudmFsdWUpKSB7XG4gICAgICAgICAgLy8gcDE6IGF2YWlsYWJsZSB2YWx1ZVxuICAgICAgICAgIHRoaXMudmFsdWUgPSB1bmRlZmluZWQ7fVxuICAgICAgICBlbHNlIGlmICh1bmRlZmluZWQgIT09IChyID0gdGhpcy54cHVsbCgpKSkge1xuICAgICAgICAgIH0vLyBwMjogeHB1bGwgdmFsdWUgKGUuZy4gcXVldWUgbWVtb3J5KSBcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgLy8gcDM6IGFkZCBuZXcgd2FpdGVyXG4gICAgICAgICAgciA9IGF3YWl0IHRoaXMuX2JpbmRfd2FpdGluZygpO1xuICAgICAgICAgIGlmICh0aGlzLmRvbmUpIHticmVha30gfVxuXG4gICAgICAgIHlpZWxkIHRoaXMueGVtaXQocik7fSB9XG5cbiAgICBmaW5hbGx5IHtcbiAgICAgIF9maW5pc2goKTt9IH1cblxuXG4sIC8vfn5+XG4gIC8vIGdlbmVyYXRvci1saWtlIHZhbHVlL2RvbmUgc3RhdGVzXG5cbiAgdmFsdWU6IHVuZGVmaW5lZFxuLCBkb25lOiBmYWxzZVxuXG4sIC8vfn5+XG4gIC8vIHByb21pc2UtYmFzZWQgZmVuY2UgdGFpbG9yZWQgZm9yIGFvX3BpcGUgdXNlY2FzZVxuXG4gIF93YWl0aW5nOiAwXG4sIF9mdWxmaWxsKCkge31cbiwgYXN5bmMgX3Jlc3VtZSgpIHtcbiAgICBpZiAoISB0aGlzLmRvbmUpIHthd2FpdCB0aGlzO31cblxuICAgIGxldCB7dmFsdWUsIF9mdWxmaWxsfSA9IHRoaXM7XG4gICAgaWYgKHVuZGVmaW5lZCAhPSB2YWx1ZSB8fCB0aGlzLmRvbmUpIHtcbiAgICAgIHRoaXMudmFsdWUgPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLl93YWl0aW5nID0gMDtcbiAgICAgIF9mdWxmaWxsKHZhbHVlKTt9IH1cblxuLCBfYmluZF93YWl0aW5nKCkge1xuICAgIGxldCBfcmVzZXQgPSB5ID0+IHRoaXMuX2Z1bGZpbGwgPSB5O1xuICAgIHRoaXMuX2JpbmRfd2FpdGluZyA9ICgpID0+IHRoaXMuX3dhaXRpbmcgfHwoXG4gICAgICB0aGlzLl93YWl0aW5nID0gbmV3IFByb21pc2UoX3Jlc2V0KSk7XG4gICAgcmV0dXJuIHRoaXMuX2JpbmRfd2FpdGluZygpfSB9O1xuXG5cbmZ1bmN0aW9uIF9maW5fcGlwZShmaW5fbHN0KSB7XG4gIHdoaWxlICgwICE9PSBmaW5fbHN0Lmxlbmd0aCkge1xuICAgIGxldCBnID0gZmluX2xzdC5wb3AoKTtcbiAgICB0cnkge1xuICAgICAgaWYgKF9pc19mbihnKSkge2coKTt9XG4gICAgICBlbHNlIGcucmV0dXJuKCk7fVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBUeXBlRXJyb3IpIHtcbiAgICAgICAgaWYgKCdHZW5lcmF0b3IgaXMgYWxyZWFkeSBydW5uaW5nJyA9PT0gZXJyLm1lc3NhZ2UpIHtcbiAgICAgICAgICBjb250aW51ZX0gfVxuICAgICAgY29uc29sZS5lcnJvcihlcnIpO30gfSB9XG5cbmNvbnN0IF9hb19waXBlX2luX2FwaSA9e1xuICBhc19waXBlX2luKHNlbGYsIGdfaW4pIHt9XG5cbiwgd2l0aF9jdHgoeGN0eCkge1xuICAgIGlmIChfaXNfZm4oeGN0eCkpIHtcbiAgICAgIHhjdHggPSB4Y3R4KHRoaXMpO31cblxuICAgIGlmICh4Y3R4ICYmIHhjdHgubmV4dCkge1xuICAgICAgeGN0eC5uZXh0KHRoaXMpO1xuICAgICAgdGhpcy5vbl9maW4oeGN0eCk7fVxuICAgIHJldHVybiB4Y3R4fVxuXG4sIGZlZWQoeHNyYywgeGZvcm0pIHtcbiAgICByZXR1cm4gYW9fZHJpdmUoeHNyYywgdGhpcywgeGZvcm0pfVxuXG4sIGJpbmRfdmVjKC4uLiBrZXlzKSB7XG4gICAgcmV0dXJuIHYgPT4gdGhpcy5uZXh0KFsuLi5rZXlzLCB2XSkgfVxuXG4sIGJpbmRfb2JqKGtleSwgbnMpIHtcbiAgICByZXR1cm4gdiA9PiB0aGlzLm5leHQoey4uLm5zLCBba2V5XTogdn0pIH0gfTtcblxuZnVuY3Rpb24gX2FvX3BpcGVfaW4oZ19pbiwgc2VsZikge1xuICByZXR1cm4gX29ial9hc3NpZ24oZ19pbiwgX2FvX3BpcGVfaW5fYXBpLCBzZWxmKX1cblxuY29uc3QgX2FvX3BpcGVfb3V0X2tpbmRzID17XG4gIGFvX3JhdzogZyA9PiBnXG4sIGFvX3NwbGl0OiBhb19zcGxpdFxuLCBhb190YXA6IGFvX3RhcH07XG5cbmZ1bmN0aW9uIF9hb19waXBlX291dChhZ19vdXQsIHNlbGYsIGtpbmQpIHtcbiAga2luZCA9IC9eYW9fLy50ZXN0KGtpbmQpID8ga2luZCA6ICdhb18nK2tpbmQ7XG4gIGxldCBhb193cmFwID0gX2FvX3BpcGVfb3V0X2tpbmRzW2tpbmRdO1xuICBpZiAodW5kZWZpbmVkID09PSBhb193cmFwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub253biBhb19waXBlX291dCBraW5kIFwiJHtraW5kfVwiYCl9XG5cbiAgcmV0dXJuIF9vYmpfYXNzaWduKGFvX3dyYXAoYWdfb3V0KSwgc2VsZikgfVxuXG5jb25zdCBfYW9fcGlwZSA9e1xuICBfX3Byb3RvX186IF9hb19waXBlX2Jhc2VcblxuLCAvLyB4Zm9sZDogdiA9PiB2IC0tIG9uIHB1c2g6IGlkZW50aXR5IHRyYW5zZm9ybVxuICAvLyB4cHVsbCgpIHt9IC0tIG1lbW9yeTogbm9uZVxuICAvLyB4ZW1pdDogX3hpbnZva2UgLS0gaWRlbnRpdHkgdHJhbnNmb3JtIG9yIGludm9rZSBpZiBmdW5jdGlvblxuXG4gIC8vICp4Z2ZvbGQoKSAtLSBvbiBwdXNoOiBnZW5lcmF0b3ItYmFzZWQgZm9sZCBpbXBsXG4gIC8vICp4c3JjKCkgLS0gZmVlZCB3aXRoIHNvdXJjZSBnZW5lcmF0b3JcbiAgLy8gKnhjdHgoZ2VuX3NyYykgLS0gb24gaW5pdDogYmluZCBldmVudCBzb3VyY2VzXG5cbiAga2luZDogJ3NwbGl0J1xuLCBfYXNfcGlwZV9pbjogX2FvX3BpcGVfaW5cbiwgX2FzX3BpcGVfb3V0OiBfYW9fcGlwZV9vdXRcblxuLCB4aW5pdChnX2luKSB7XG4gICAgbGV0IHhnZm9sZCA9IHRoaXMueGdmb2xkO1xuICAgIGlmICh1bmRlZmluZWQgIT09IHhnZm9sZCkge1xuICAgICAgdGhpcy5faW5pdF94Z2ZvbGQoZ19pbiwgeGdmb2xkKTt9XG5cbiAgICB0aGlzLl9pbml0X2NoYWluKGdfaW4pO31cblxuXG4sIF9pbml0X3hnZm9sZChnX2luLCB4Z2ZvbGQpIHtcbiAgICBpZiAodW5kZWZpbmVkID09PSB4Z2ZvbGQpIHtcbiAgICAgIHJldHVybn1cblxuICAgIGlmIChfaXNfZm4oeGdmb2xkKSkge1xuICAgICAgeGdmb2xkID0geGdmb2xkLmNhbGwodGhpcywgdGhpcyk7XG5cbiAgICAgIGlmIChfaXNfZm4oeGdmb2xkKSkge1xuICAgICAgICB0aGlzLnhmb2xkID0geGdmb2xkO1xuICAgICAgICByZXR1cm4gdHJ1ZX1cblxuICAgICAgeGdmb2xkLm5leHQoKTt9XG5cbiAgICB0aGlzLnhnZm9sZCA9IHhnZm9sZDtcbiAgICB0aGlzLnhmb2xkID0gdGhpcy5fZm9sZF9nZW47XG4gICAgZ19pbi5vbl9maW4oeGdmb2xkKTtcbiAgICByZXR1cm4gdHJ1ZX1cblxuLCBfZm9sZF9nZW4odikge1xuICAgIGxldCB7ZG9uZSwgdmFsdWV9ID0gdGhpcy54Z2ZvbGQubmV4dCh2KTtcbiAgICBpZiAoZG9uZSkge3RoaXMuZG9uZSA9IHRydWU7fVxuICAgIHJldHVybiB2YWx1ZX1cblxuXG4sIF9pbml0X2NoYWluKGdfaW4pIHtcbiAgICBsZXQge3hzcmMsIHhjdHh9ID0gdGhpcztcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4c3JjKSB7XG4gICAgICBnX2luLmZlZWQoeHNyYylcbiAgICAgICAgLnRoZW4gKCgpID0+Z19pbi5yZXR1cm4oKSk7IH1cblxuICAgIGlmICh1bmRlZmluZWQgIT09IHhjdHgpIHtcbiAgICAgIGdfaW4ud2l0aF9jdHgoeGN0eCk7fSB9IH07XG5cblxuY29uc3QgYW9fcGlwZSA9IF9hb19waXBlLmNyZWF0ZTtcblxuZnVuY3Rpb24gYW9faW50ZXJ2YWwobXM9MTAwMCkge1xuICBsZXQgW19mZW5jZSwgX3Jlc2V0XSA9IGFvX2ZlbmNlX2ZuKCk7XG4gIGxldCB0aWQgPSBzZXRJbnRlcnZhbChfcmVzZXQsIG1zLCAxKTtcbiAgaWYgKHRpZC51bnJlZikge3RpZC51bnJlZigpO31cbiAgX2ZlbmNlLnN0b3AgPSAoKCkgPT4ge1xuICAgIHRpZCA9IGNsZWFySW50ZXJ2YWwodGlkKTtcbiAgICBfZmVuY2UuZG9uZSA9IHRydWU7fSk7XG4gIHJldHVybiBfZmVuY2V9XG5cblxuZnVuY3Rpb24gYW9fdGltZW91dChtcz0xMDAwKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXNldF0gPSBhb19mZW5jZV9mbih0aW1lb3V0KTtcbiAgcmV0dXJuIHRpbWVvdXRcblxuICBmdW5jdGlvbiB0aW1lb3V0KCkge1xuICAgIHRpZCA9IHNldFRpbWVvdXQoX3Jlc2V0LCBtcywgMSk7XG4gICAgaWYgKHRpZC51bnJlZikge3RpZC51bnJlZigpO31cbiAgICByZXR1cm4gX2ZlbmNlKCl9IH1cblxuXG5mdW5jdGlvbiBhb19kZWJvdW5jZShtcz0zMDAsIGdlbl9pbikge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzZXRdID0gYW9fZmVuY2VfZm4oKTtcblxuICBfZmVuY2UuZmluID0gKChhc3luYyAoKSA9PiB7XG4gICAgZm9yIGF3YWl0IChsZXQgdiBvZiBfeGludm9rZShnZW5faW4pKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGlkKTtcbiAgICAgIHRpZCA9IHNldFRpbWVvdXQoX3Jlc2V0LCBtcywgdik7fSB9KSgpKTtcblxuICByZXR1cm4gX2ZlbmNlfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9fdGltZXMoZ2VuX2luKSB7XG4gIGxldCB0czAgPSBEYXRlLm5vdygpO1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIGdlbl9pbikge1xuICAgIHlpZWxkIERhdGUubm93KCkgLSB0czA7fSB9XG5cbmZ1bmN0aW9uIGFvX2RvbV9hbmltYXRpb24oKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXNldF0gPSBhb19mZW5jZV9mbihyYWYpO1xuICByYWYuc3RvcCA9ICgoKSA9PiB7XG4gICAgdGlkID0gY2FuY2VsQW5pbWF0aW9uRnJhbWUodGlkKTtcbiAgICByYWYuZG9uZSA9IHRydWU7fSk7XG4gIHJldHVybiByYWZcblxuICBmdW5jdGlvbiByYWYoKSB7XG4gICAgdGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKF9yZXNldCk7XG4gICAgcmV0dXJuIF9mZW5jZSgpfSB9XG5cbmNvbnN0IGFvX2RvbV9ldmVudHMgPVxuICBfd21fcGlwZV9jbG9zdXJlKF9hb19kb21fZXZlbnRzX2N0eCk7XG5cbmZ1bmN0aW9uIF9hb19kb21fZXZlbnRzX2N0eChnX2luKSB7XG4gIHJldHVybiB7X19wcm90b19fOiBfZG9tX2V2ZW50c19hcGlcbiAgLCB3bV9lbGVtczogbmV3IFdlYWtNYXAoKVxuICAsIGVtaXQ6IGluZm8gPT4gZ19pbi5uZXh0KGluZm8pfSB9XG5cblxuY29uc3QgX2RvbV9ldmVudHNfYXBpID17XG4gIC8vIHdtX2VsZW1zOiBuZXcgV2Vha01hcCgpXG4gIC8vIGVtaXQ6IGluZm8gPT4gZ19pbi5uZXh0KGluZm8pXG5cbiAgbGlzdGVuKGVsZW0sIGV2dCwgeGZuLCBldnRfb3B0KSB7XG4gICAgbGV0IHtlbWl0LCBpbmZvfSA9IHRoaXM7XG4gICAgIHtcbiAgICAgIGxldCBlbSA9IF93bV9pdGVtKHRoaXMud21fZWxlbXMsIGVsZW0sIF9lbGVtX21hcF9lbnRyeSk7XG4gICAgICBpbmZvID17Li4uIGluZm8sIC4uLiBlbS5pbmZvLCBldnR9O1xuXG4gICAgICBsZXQgZXZ0MCA9IGV2dC5zcGxpdCgvW18uXS8sIDEpWzBdO1xuICAgICAgaWYgKCdpbml0JyA9PT0gZXZ0MCkge1xuICAgICAgICBldnRfZm4oZWxlbSk7XG4gICAgICAgIHJldHVybiB0aGlzfVxuXG4gICAgICBsZXQgb2xkX2ZuID0gZW0uZ2V0KGV2dCk7XG5cbiAgICAgIGVsZW0uYWRkRXZlbnRMaXN0ZW5lcihldnQwLCBldnRfZm4sIGV2dF9vcHQpO1xuICAgICAgZW0uc2V0KGV2dCwgZXZ0X2ZuKTtcblxuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0gb2xkX2ZuKSB7XG4gICAgICAgIGVsZW0ucmVtb3ZlRXZlbnRMaXN0ZW5lcihldnQwLCBvbGRfZm4pOyB9XG5cbiAgICAgIGlmICgnbWVzc2FnZScgPT09IGV2dDAgJiYgX2lzX2ZuKGVsZW0uc3RhcnQpKSB7XG4gICAgICAgIGVsZW0uc3RhcnQoKTt9IH1cblxuICAgIHJldHVybiB0aGlzXG5cbiAgICBmdW5jdGlvbiBldnRfZm4oZSkge1xuICAgICAgbGV0IHYgPSB4Zm4oZSwgZW1pdCwgaW5mbyk7XG4gICAgICBpZiAodW5kZWZpbmVkICE9PSB2KSB7XG4gICAgICAgIGVtaXQoey4uLiBpbmZvLCB2fSk7IH0gfSB9XG5cblxuLCByZW1vdmUoZWxlbSwgLi4uIGtleXMpIHtcbiAgICBsZXQge3dtX2VsZW1zfSA9IHRoaXM7XG4gICAgbGV0IGV2dF9tYXAgPSB3bV9lbGVtcy5nZXQoZWxlbSkgfHwgbmV3IE1hcCgpO1xuXG4gICAgbGV0IGV2X3BhaXJzO1xuICAgIGlmICgwID09PSBrZXlzLmxlbmd0aCkge1xuICAgICAgd21fZWxlbXMuZGVsZXRlKGVsZW0pO1xuICAgICAgZXZfcGFpcnMgPSBldnRfbWFwLmVudHJpZXMoKTt9XG5cbiAgICBlbHNlIHtcbiAgICAgIGV2X3BhaXJzID0ga2V5cy5tYXAoXG4gICAgICAgIGV2dDAgPT4gW2V2dDAsIGV2dF9tYXAuZ2V0KGV2dDApXSk7IH1cblxuICAgIGZvciAobGV0IFtldnQwLCBldnRfZm5dIG9mIGV2X3BhaXJzKSB7XG4gICAgICBpZiAodW5kZWZpbmVkICE9PSBldnRfZm4pIHtcbiAgICAgICAgZXZ0X21hcC5kZWxldGUoZXZ0MCk7XG4gICAgICAgIGVsZW0ucmVtb3ZlRXZlbnRMaXN0ZW5lcihldnQwLCBldnRfZm4pO30gfVxuICAgIHJldHVybiB0aGlzfVxuXG5cbiwgc2V0X2luZm8oZWwsIGluZm8pIHtcbiAgICBsZXQgZW0gPSBfd21faXRlbSh0aGlzLndtX2VsZW1zLCBlbCwgX2VsZW1fbWFwX2VudHJ5KTtcbiAgICBfb2JqX2Fzc2lnbihlbS5pbmZvLCBpbmZvKTtcbiAgICByZXR1cm4gdGhpc31cblxuLCB3aXRoKC4uLiBuc19hcmdzKSB7XG4gICAgbGV0IHtsaXN0ZW4sIHNldF9pbmZvLCBpbmZvfSA9IHRoaXM7XG4gICAgc2V0X2luZm8gPSBzZXRfaW5mby5iaW5kKHRoaXMpO1xuXG4gICAgZm9yIChsZXQgbnMgb2YgbnNfYXJncykge1xuICAgICAgbGV0IG5zX3RoaXMgPSB1bmRlZmluZWQgPT09IG5zLmluZm8gPyB0aGlzIDpcbiAgICAgICAge19fcHJvdG9fXzogdGhpcywgaW5mbzp7Li4uIGluZm8sIC4uLiBucy5pbmZvfX07XG5cbiAgICAgIGxldCBldmVudHMgPVsuLi4gX2l0ZXJfZXZlbnRfbGlzdChucyldO1xuICAgICAgZm9yIChsZXQgZWxlbSBvZiBfaXRlcl9uYW1lZF9lbGVtcyhucy4kLCBzZXRfaW5mbykpIHtcbiAgICAgICAgZm9yIChsZXQgZXZ0X2FyZ3Mgb2YgZXZlbnRzKSB7XG4gICAgICAgICAgbGlzdGVuLmNhbGwobnNfdGhpcywgZWxlbSwgLi4uIGV2dF9hcmdzKTt9IH0gfVxuXG4gICAgcmV0dXJuIHRoaXN9IH07XG5cblxuZnVuY3Rpb24gX2VsZW1fbWFwX2VudHJ5KGVsZW0pIHtcbiAgbGV0IGsgPSBlbGVtLm5hbWUgfHwgZWxlbS5pZFxuICAgIHx8IChlbGVtLnR5cGUgfHwgZWxlbS50YWdOYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgfHwgZWxlbVtTeW1ib2wudG9TdHJpbmdUYWddO1xuXG4gIGxldCBtID0gbmV3IE1hcCgpO1xuICBtLmluZm8gPXtkb21faXRlbTogaywga307XG4gIHJldHVybiBtfVxuXG5cbmZ1bmN0aW9uICogX2l0ZXJfbmFtZWRfZWxlbXMobHN0LCBzZXRfaW5mbykge1xuICBsc3QgPSBfaXNfYXJyYXkobHN0KSA/IGxzdFxuICAgIDogbHN0LmFkZEV2ZW50TGlzdGVuZXIgPyBbbHN0XVxuICAgIDogT2JqZWN0LmVudHJpZXMobHN0KTtcblxuICBmb3IgKGxldCBlYSBvZiBsc3QpIHtcbiAgICBpZiAoX2lzX2FycmF5KGVhKSkge1xuICAgICAgc2V0X2luZm8oZWFbMV0sIHtrOiBlYVswXX0pO1xuICAgICAgeWllbGQgZWFbMV07fVxuXG4gICAgZWxzZSB5aWVsZCBlYTt9IH1cblxuXG5mdW5jdGlvbiAqIF9pdGVyX2V2ZW50X2xpc3QobnMpIHtcbiAgZm9yIChsZXQgW2F0dHIsIGVmbl0gb2YgT2JqZWN0LmVudHJpZXMobnMpKSB7XG4gICAgaWYgKCEgZWZuIHx8IC9bXmEtel0vLnRlc3QoYXR0cikpIHtcbiAgICAgIGNvbnRpbnVlfVxuXG4gICAgYXR0ciA9IGF0dHIucmVwbGFjZSgnXycsICcuJyk7XG4gICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBlZm4pIHtcbiAgICAgIHlpZWxkIFthdHRyLCBlZm4sIGVmbi5ldnRfb3B0XTt9XG5cbiAgICBlbHNlIGlmIChlZm4ub25fZXZ0IHx8IGVmbi5ldnRfb3B0KSB7XG4gICAgICB5aWVsZCBbYXR0ciwgZWZuLm9uX2V2dCwgZWZuLmV2dF9vcHRdO30gfSB9XG5cbmV4cG9ydCB7IF9hb19kb21fZXZlbnRzX2N0eCwgX2FvX3BpcGUsIF9hb19waXBlX2Jhc2UsIF9hb19waXBlX2luLCBfYW9fcGlwZV9pbl9hcGksIF9hb19waXBlX291dCwgX2FvX3BpcGVfb3V0X2tpbmRzLCBfYW9fdGFwLCBfZG9tX2V2ZW50c19hcGksIF93bV9jbG9zdXJlLCBfd21faXRlbSwgX3dtX3BpcGVfY2xvc3VyZSwgX3hpbnZva2UkMSBhcyBfeGludm9rZSwgX3hwaXBlX3RndCwgYW9fZGVib3VuY2UsIGFvX2RlZmVycmVkLCBhb19kZWZlcnJlZF92LCBhb19kb21fYW5pbWF0aW9uLCBhb19kb21fZXZlbnRzLCBhb19kcml2ZSwgYW9fZmVuY2VfZm4sIGFvX2ZlbmNlX2ZvcmssIGFvX2ZlbmNlX29iaiwgYW9fZmVuY2VfdiwgYW9faW50ZXJ2YWwsIGFvX2l0ZXIsIGFvX3BpcGUsIGFvX3J1biwgYW9fc3BsaXQsIGFvX3N0ZXBfaXRlciwgYW9fdGFwLCBhb190aW1lb3V0LCBhb190aW1lcywgZm5fY2hhaW4sIGlzX2FvX2l0ZXIsIGl0ZXIsIHN0ZXBfaXRlciB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cm9hcC5tanMubWFwXG4iLCJpbXBvcnQge2Fzc2VydCwgaXNfZm59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuaW1wb3J0IHthb19kZWZlcnJlZCwgYW9fZGVmZXJyZWRfdn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fZmVuY2VfdiwgYW9fZmVuY2VfZm4sIGFvX2ZlbmNlX29ian0gZnJvbSAncm9hcCdcbmltcG9ydCB7aXRlciwgc3RlcF9pdGVyLCBhb19pdGVyLCBhb19zdGVwX2l0ZXJ9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3J1biwgYW9fZHJpdmV9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3NwbGl0LCBhb190YXB9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3BpcGV9IGZyb20gJ3JvYXAnXG5cbmRlc2NyaWJlIEAgJ3Ntb2tlJywgQDo6XG4gIGl0IEAgJ2RlZmVycmVkJywgQDo6XG4gICAgaXNfZm4gQCBhb19kZWZlcnJlZFxuICAgIGlzX2ZuIEAgYW9fZGVmZXJyZWRfdlxuXG4gIGl0IEAgJ2ZlbmNlJywgQDo6XG4gICAgaXNfZm4gQCBhb19mZW5jZV92XG4gICAgaXNfZm4gQCBhb19mZW5jZV9mblxuICAgIGlzX2ZuIEAgYW9fZmVuY2Vfb2JqXG5cbiAgaXQgQCAnZHJpdmUnLCBAOjpcbiAgICBpc19mbiBAIGl0ZXJcbiAgICBpc19mbiBAIHN0ZXBfaXRlclxuICAgIGlzX2ZuIEAgYW9faXRlclxuICAgIGlzX2ZuIEAgYW9fc3RlcF9pdGVyXG4gICAgXG4gICAgaXNfZm4gQCBhb19ydW5cbiAgICBpc19mbiBAIGFvX2RyaXZlXG5cbiAgaXQgQCAnc3BsaXQnLCBAOjpcbiAgICBpc19mbiBAIGFvX3NwbGl0XG4gICAgaXNfZm4gQCBhb190YXBcblxuICBpdCBAICdwaXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19waXBlXG5cbiIsImltcG9ydCB7YW9fZGVmZXJyZWQsIGFvX2RlZmVycmVkX3Z9IGZyb20gJ3JvYXAnXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSxcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGFvX2RlZmVycmVkJywgQDo6XG5cbiAgZGVzY3JpYmUgQCAnYW9fZGVmZXJyZWRfdiB0dXBsZScsIEA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBjb25zdCByZXMgPSBhb19kZWZlcnJlZF92KClcbiAgICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdhcnJheScpLm9mLmxlbmd0aCgzKVxuICAgICAgZXhwZWN0KHJlc1swXSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocmVzWzFdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzWzJdKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpdCBAICd1c2UsIHJlc29sdmUnLCBAOjo+XG4gICAgICBjb25zdCBbcCwgcmVzb2x2ZSwgcmVqZWN0XSA9IGFvX2RlZmVycmVkX3YoKVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXNvbHZlKCd5dXAnKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3l1cCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgaXQgQCAndXNlLCByZWplY3QnLCBAOjo+XG4gICAgICBjb25zdCBbcCwgcmVzb2x2ZSwgcmVqZWN0XSA9IGFvX2RlZmVycmVkX3YoKVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZWplY3QgQCBuZXcgRXJyb3IoJ25vcGUnKVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgYXdhaXQgcFxuICAgICAgICBhc3NlcnQuZmFpbCgpXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgYXNzZXJ0LmVxdWFsIEAgJ25vcGUnLCBlcnIubWVzc2FnZVxuXG5cblxuICBkZXNjcmliZSBAICdhb19kZWZlcnJlZCBvYmplY3QnLCBAOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXJyZWQoKVxuICAgICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ29iamVjdCcpXG4gICAgICBleHBlY3QocmVzLnByb21pc2UpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHJlcy5yZXNvbHZlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzLnJlamVjdCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAndXNlLCByZXNvbHZlJywgQDo6PlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXJyZWQoKVxuICAgICAgbGV0IHAgPSByZXMucHJvbWlzZVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXMucmVzb2x2ZSgneXVwJylcbiAgICAgIGFzc2VydC5lcXVhbCBAICd5dXAnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIGl0IEAgJ3VzZSwgcmVqZWN0JywgQDo6PlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXJyZWQoKVxuICAgICAgbGV0IHAgPSByZXMucHJvbWlzZVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXMucmVqZWN0IEAgbmV3IEVycm9yKCdub3BlJylcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3BlJywgZXJyLm1lc3NhZ2VcblxuIiwiaW1wb3J0IHthb19mZW5jZV9vYmosIGFvX2ZlbmNlX3Z9IGZyb20gJ3JvYXAnXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSxcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGFvX2ZlbmNlJywgQDo6XG4gIGRlc2NyaWJlIEAgJ2FvX2ZlbmNlX3YgdHVwbGUnLCBAOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgY29uc3QgcmVzID0gYW9fZmVuY2VfdigpXG4gICAgICBleHBlY3QocmVzKS50by5iZS5hbignYXJyYXknKS5vZi5sZW5ndGgoMilcbiAgICAgIGV4cGVjdChyZXNbMF0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXNbMV0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuXG4gICAgaXQgQCAnYmFzaWMgdXNlJywgQDo6PlxuICAgICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfdigpXG5cbiAgICAgIGNvbnN0IHAgPSBmZW5jZSgpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXN1bWUoMTk0MilcbiAgICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG5cbiAgICBpdCBAICdvbmx5IGZpcnN0IGFmdGVyJywgQDo6PlxuICAgICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfdigpXG4gICAgICBsZXQgZlxuXG4gICAgICByZXN1bWUgQCAnb25lJ1xuICAgICAgZiA9IGZlbmNlKClcbiAgICAgIHJlc3VtZSBAICd0d28nXG4gICAgICByZXN1bWUgQCAndGhyZWUnXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0d28nLCBhd2FpdCBmXG5cbiAgICAgIHJlc3VtZSBAICdmb3VyJ1xuICAgICAgcmVzdW1lIEAgJ2ZpdmUnXG4gICAgICBmID0gZmVuY2UoKVxuICAgICAgcmVzdW1lIEAgJ3NpeCdcbiAgICAgIHJlc3VtZSBAICdzZXZlbidcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3NpeCcsIGF3YWl0IGZcblxuXG4gICAgaXQgQCAnbmV2ZXIgYmxvY2tlZCBvbiBmZW5jZScsIEA6Oj5cbiAgICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuXG4gICAgICByZXN1bWUgQCAnb25lJ1xuICAgICAgcmVzdW1lIEAgJ3R3bydcbiAgICAgIHJlc3VtZSBAICd0aHJlZSdcblxuXG4gICAgaXQgQCAnZXhlcmNpc2UgZmVuY2UnLCBAOjo+XG4gICAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcblxuICAgICAgbGV0IHYgPSAnYSdcbiAgICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYScpXG5cbiAgICAgIGNvbnN0IHAgPSBAIT5cbiAgICAgICAgdiA9ICdiJ1xuXG4gICAgICAgIDo6IGNvbnN0IGFucyA9IGF3YWl0IGZlbmNlKClcbiAgICAgICAgICAgZXhwZWN0KGFucykudG8uZXF1YWwoJ2JiJylcblxuICAgICAgICB2ID0gJ2MnXG4gICAgICAgIDo6IGNvbnN0IGFucyA9IGF3YWl0IGZlbmNlKClcbiAgICAgICAgICAgZXhwZWN0KGFucykudG8uZXF1YWwoJ2NjJylcbiAgICAgICAgdiA9ICdkJ1xuICAgICAgICByZXR1cm4gMTk0MlxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdiJylcblxuICAgICAgOjpcbiAgICAgICAgY29uc3QgcCA9IHJlc3VtZSh2K3YpXG4gICAgICAgIGV4cGVjdChwKS50by5iZS51bmRlZmluZWRcblxuICAgICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdiJylcbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG4gICAgICBleHBlY3QodikudG8uZXF1YWwoJ2MnKVxuXG4gICAgICA6OlxuICAgICAgICBjb25zdCBwID0gcmVzdW1lKHYrdilcbiAgICAgICAgZXhwZWN0KHApLnRvLmJlLnVuZGVmaW5lZFxuXG4gICAgICBleHBlY3QodikudG8uZXF1YWwoJ2MnKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG4gICAgICBleHBlY3QodikudG8uZXF1YWwoJ2QnKVxuXG5cbiAgZGVzY3JpYmUgQCAnYW9fZmVuY2Ugb2JqZWN0JywgQDo6XG4gICAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX29iaigpXG4gICAgICBleHBlY3QocmVzKS50by5iZS5hbignb2JqZWN0JylcbiAgICAgIGV4cGVjdChyZXMuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXMucmVzZXQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXMuYW9fZm9yaykudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlc1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuXG4gICAgaXQgQCAnYmFzaWMgdXNlJywgQDo6PlxuICAgICAgY29uc3QgcmVzID0gYW9fZmVuY2Vfb2JqKClcblxuICAgICAgY29uc3QgcCA9IHJlcy5mZW5jZSgpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXMucmVzZXQoMTk0MilcbiAgICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG5cbiAgICBpdCBAICdhc3luYyBpdGVyIHVzZScsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX29iaigpXG5cbiAgICAgIGRlbGF5KCkudGhlbiBAPT4gcmVzLnJlc2V0KCdyZWFkeScpXG5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgdlxuICAgICAgICBicmVha1xuXG5cbiAgICBpdCBAICdhc3luYyBpdGVyIG11bHRpIHVzZScsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX29iaigpXG5cbiAgICAgIGxldCBwYSA9IEAhPlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzIDo6XG4gICAgICAgICAgcmV0dXJuIGBwYSAke3Z9YFxuXG4gICAgICBsZXQgcGIgPSBAIT5cbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcy5hb19mb3JrKCkgOjpcbiAgICAgICAgICByZXR1cm4gYHBiICR7dn1gXG5cbiAgICAgIGxldCBwYyA9IHJlcy5mZW5jZSgpXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuICAgICAgcmVzLnJlc2V0KCdyZWFkeScpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAncGEgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAncGIgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiIsImltcG9ydCB7YW9fcnVuLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksIGRlbGF5X3dhbGtcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGRyaXZlJywgQDo6XG5cbiAgaXQgQCAnYW9fcnVuJywgQDo6PlxuICAgIGxldCBsc3QgPSBbXVxuICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgbGV0IHAgPSBhb19ydW4gQCBnLCB2ID0+IGxzdC5wdXNoKHYpXG5cbiAgICBleHBlY3QocCkudG8uYmUuYShcInByb21pc2VcIilcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgcCwgdW5kZWZpbmVkXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxzdCwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcblxuICBpdCBAICdhb19kcml2ZSBnZW5lcmF0b3InLCBAOjo+XG4gICAgbGV0IGxzdCA9IFtdXG4gICAgbGV0IGdfdGd0ID0gZ2VuX3Rlc3QobHN0KVxuICAgIGdfdGd0Lm5leHQoJ2ZpcnN0JylcbiAgICBnX3RndC5uZXh0KCdzZWNvbmQnKVxuICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgbGV0IHAgPSBhb19kcml2ZSBAIGcsIGdfdGd0LCB2ID0+IFsneGUnLCB2XVxuXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoXCJwcm9taXNlXCIpXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHAsIHVuZGVmaW5lZFxuICAgIGdfdGd0Lm5leHQoJ2ZpbmFsJylcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsc3QsIEBbXVxuICAgICAgJ3NlY29uZCdcbiAgICAgIEBbXSAneGUnLCAxOTQyXG4gICAgICBAW10gJ3hlJywgMjA0MlxuICAgICAgQFtdICd4ZScsIDIxNDJcbiAgICAgICdmaW5hbCdcblxuICAgIGZ1bmN0aW9uICogZ2VuX3Rlc3QobHN0KSA6OlxuICAgICAgd2hpbGUgMSA6OlxuICAgICAgICBsZXQgdiA9IHlpZWxkXG4gICAgICAgIGxzdC5wdXNoKHYpXG5cbiAgaXQgQCAnYW9fZHJpdmUgZnVuY3Rpb24nLCBAOjo+XG4gICAgbGV0IGxzdCA9IFtdXG4gICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICBsZXQgcCA9IGFvX2RyaXZlIEAgZywgZ2VuX3Rlc3QsIHYgPT4gWyd4ZScsIHZdXG5cbiAgICBleHBlY3QocCkudG8uYmUuYShcInByb21pc2VcIilcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgcCwgdW5kZWZpbmVkXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbHN0LCBAW11cbiAgICAgIEBbXSAneGUnLCAxOTQyXG4gICAgICBAW10gJ3hlJywgMjA0MlxuICAgICAgQFtdICd4ZScsIDIxNDJcblxuICAgIGZ1bmN0aW9uICogZ2VuX3Rlc3QoKSA6OlxuICAgICAgd2hpbGUgMSA6OlxuICAgICAgICBsZXQgdiA9IHlpZWxkXG4gICAgICAgIGxzdC5wdXNoKHYpXG5cbiIsImltcG9ydCB7aXRlciwgYW9faXRlcn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fc3RlcF9pdGVyLCBzdGVwX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGFycmF5X2Zyb21fYW9faXRlcixcbiAgaXNfZ2VuXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBkcml2ZSBpdGVycycsIEA6OlxuXG4gIGl0IEAgJ25vcm1hbCBpdGVyJywgQDo6XG4gICAgbGV0IGcgPSBpc19nZW4gQCBpdGVyIEAjIDEwLCAyMCwgMzBcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAge3ZhbHVlOiAxMCwgZG9uZTogZmFsc2V9LCBnLm5leHQoKVxuXG5cbiAgaXQgQCAnYXN5bmMgaXRlcicsIEA6Oj5cbiAgICBsZXQgZyA9IGlzX2dlbiBAIGFvX2l0ZXIgQCMgMTAsIDIwLCAzMFxuXG4gICAgbGV0IHAgPSBnLm5leHQoKVxuICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB7dmFsdWU6IDEwLCBkb25lOiBmYWxzZX0sIGF3YWl0IHBcblxuXG4gIGl0IEAgJ25vcm1hbCBzdGVwX2l0ZXInLCBAOjpcbiAgICBsZXQgeiA9IEFycmF5LmZyb20gQFxuICAgICAgemlwIEBcbiAgICAgICAgWzEwLCAyMCwgMzBdXG4gICAgICAgIFsnYScsICdiJywgJ2MnXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHosIEBbXVxuICAgICAgWzEwLCAnYSddXG4gICAgICBbMjAsICdiJ11cbiAgICAgIFszMCwgJ2MnXVxuXG4gICAgZnVuY3Rpb24gKiB6aXAoYSwgYikgOjpcbiAgICAgIGIgPSBzdGVwX2l0ZXIoYilcbiAgICAgIGZvciBsZXQgYXYgb2YgaXRlcihhKSA6OlxuICAgICAgICBmb3IgbGV0IGJ2IG9mIGIgOjpcbiAgICAgICAgICB5aWVsZCBbYXYsIGJ2XVxuXG5cbiAgaXQgQCAnYXN5bmMgYW9fc3RlcF9pdGVyJywgQDo6PlxuICAgIGxldCB6ID0gYXdhaXQgYXJyYXlfZnJvbV9hb19pdGVyIEBcbiAgICAgIGFvX3ppcCBAXG4gICAgICAgIFsxMCwgMjAsIDMwXVxuICAgICAgICBbJ2EnLCAnYicsICdjJ11cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB6LCBAW11cbiAgICAgIFsxMCwgJ2EnXVxuICAgICAgWzIwLCAnYiddXG4gICAgICBbMzAsICdjJ11cblxuXG4gICAgYXN5bmMgZnVuY3Rpb24gKiBhb196aXAoYSwgYikgOjpcbiAgICAgIGIgPSBhb19zdGVwX2l0ZXIoYilcbiAgICAgIGZvciBhd2FpdCBsZXQgYXYgb2YgYW9faXRlcihhKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IGJ2IG9mIGIgOjpcbiAgICAgICAgICB5aWVsZCBbYXYsIGJ2XVxuXG4iLCJpbXBvcnQge2FvX3NwbGl0LCBhb190YXB9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LCBkZWxheV93YWxrLFxuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBzcGxpdCcsIEA6OlxuXG4gIGRlc2NyaWJlIEAgJ2FvX3NwbGl0JywgQDo6XG4gICAgaXQgQCAndHJpcGxlJywgQDo6PlxuICAgICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGxldCBncyA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgYW9fc3BsaXQoZylcblxuICAgICAgZXhwZWN0KGdzLmZpbikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoZ3MuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgICAgbGV0IHAgPSBncy5mZW5jZSgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBhID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzKVxuICAgICAgZXhwZWN0KGEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgbGV0IGIgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG4gICAgICBleHBlY3QoYikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYyA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYykudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGFzc2VydC5lcXVhbChhd2FpdCBwLCAxOTQyKVxuXG4gICAgICBwID0gZ3MuZmVuY2UoKVxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDIwNDIpXG5cbiAgICAgIHAgPSBncy5mZW5jZSgpXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMjE0MilcblxuICAgICAgYXdhaXQgZ3MuZmluXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYSA9IGF3YWl0IGEsIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYiA9IGF3YWl0IGIsIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYyA9IGF3YWl0IGMsIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG5cbiAgICAgIGFzc2VydCBAIGEgIT09IGJcbiAgICAgIGFzc2VydCBAIGEgIT09IGNcbiAgICAgIGFzc2VydCBAIGIgIT09IGNcblxuXG4gIGRlc2NyaWJlIEAgJ2FvX3RhcCcsIEA6OlxuICAgIGl0IEAgJ3RyaXBsZScsIEA6Oj5cbiAgICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBsZXQgZ3MgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX3RhcChnKVxuXG4gICAgICBleHBlY3QoZ3MuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgICAgbGV0IHAgPSBncy5mZW5jZSgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBhID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzLmFvX2ZvcmsoKSlcbiAgICAgIGV4cGVjdChhKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBiID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzLmFvX2ZvcmsoKSlcbiAgICAgIGV4cGVjdChiKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBjID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzLmFvX2ZvcmsoKSlcbiAgICAgIGV4cGVjdChjKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzKVxuXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMTk0MilcblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGEgPSBhd2FpdCBhLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGIgPSBhd2FpdCBiLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGMgPSBhd2FpdCBjLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuXG4gICAgICBhc3NlcnQgQCBhICE9PSBiXG4gICAgICBhc3NlcnQgQCBhICE9PSBjXG4gICAgICBhc3NlcnQgQCBiICE9PSBjXG5cbiIsImltcG9ydCB7X2FvX3BpcGVfYmFzZSwgYW9fZHJpdmV9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LCBkZWxheV93YWxrXG4gIGFycmF5X2Zyb21fYW9faXRlcixcbiAgaXNfZm4sIGlzX2dlbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIF9hb19waXBlX2Jhc2UnLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBsZXQgcGlwZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgX2FvX3BpcGVfYmFzZS5jcmVhdGUoKVxuICAgIGlzX2dlbiBAIHBpcGUuZ19pblxuXG5cbiAgaXQgQCAnZXhhbXBsZScsIEA6Oj5cbiAgICBsZXQgcGlwZSA9IF9hb19waXBlX2Jhc2UuY3JlYXRlKClcbiAgICBsZXQgeiA9IGNvbW1vbl9hb19waXBlX2Jhc2UgQCBwaXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG4gIGl0IEAgJ3hmb2xkJywgQDo6PlxuICAgIGxldCBwaXBlID0gX2FvX3BpcGVfYmFzZS5jcmVhdGUgQDo6XG4gICAgICBsZXQgcyA9IDBcbiAgICAgIHJldHVybiBAe30geGZvbGQ6IHYgPT4gcyArPSB2XG5cbiAgICBsZXQgeiA9IGNvbW1vbl9hb19waXBlX2Jhc2UgQCBwaXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSAxOTQyLCAxOTQyKzIwNDIsIDE5NDIrMjA0MisyMTQyXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneGVtaXQnLCBAOjo+XG4gICAgbGV0IHBpcGUgPSBfYW9fcGlwZV9iYXNlLmNyZWF0ZSBAOlxuICAgICAgeGVtaXQ6IHYgPT4gWyd4ZScsIHZdXG5cbiAgICBsZXQgeiA9IGNvbW1vbl9hb19waXBlX2Jhc2UgQCBwaXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSBbJ3hlJywgMTk0Ml1cbiAgICAgICAgICBbJ3hlJywgMjA0Ml1cbiAgICAgICAgICBbJ3hlJywgMjE0Ml1cbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICBpdCBAICd4cHVsbCcsIEA6Oj5cbiAgICBsZXQgcGlwZSA9IF9hb19waXBlX2Jhc2UuY3JlYXRlIEA6OlxuICAgICAgbGV0IG1lbSA9IFtdXG4gICAgICByZXR1cm4gQHt9XG4gICAgICAgIHhmb2xkKHYpIDo6XG4gICAgICAgICAgaWYgdW5kZWZpbmVkICE9PSB2IDo6XG4gICAgICAgICAgICBtZW0ucHVzaCh2KVxuICAgICAgICAgIHJldHVybiBtZW1bMF1cbiAgICAgICAgeHB1bGwoKSA6OlxuICAgICAgICAgIHJldHVybiBtZW1bMF1cbiAgICAgICAgeGVtaXQoKSA6OlxuICAgICAgICAgIGxldCB0aXAgPSBtZW0uc2hpZnQoKVxuICAgICAgICAgIGxldCBxID0gbWVtLnNsaWNlKClcbiAgICAgICAgICByZXR1cm4gQHt9IHRpcCwgcVxuXG4gICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIocGlwZSlcbiAgICBmb3IgbGV0IHYgb2YgWzE5NDIsIDIwNDIsIDIxNDJdIDo6XG4gICAgICBwaXBlLmdfaW4ubmV4dCh2KVxuXG4gICAgYXdhaXQgZGVsYXkoMSlcbiAgICBwaXBlLmdfaW4ucmV0dXJuKClcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgQFtdXG4gICAgICAgIEB7fSB0aXA6IDE5NDIsIHE6IEBbXSAyMDQyLCAyMTQyXG4gICAgICAgIEB7fSB0aXA6IDIwNDIsIHE6IEBbXSAyMTQyXG4gICAgICAgIEB7fSB0aXA6IDIxNDIsIHE6IEBbXVxuICAgICAgYXdhaXQgelxuXG5cbiAgYXN5bmMgZnVuY3Rpb24gY29tbW9uX2FvX3BpcGVfYmFzZShwaXBlLCB2YWx1ZXMpIDo6XG4gICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIocGlwZSlcblxuICAgIGF3YWl0IGFvX2RyaXZlIEBcbiAgICAgIGRlbGF5X3dhbGsodmFsdWVzKVxuICAgICAgcGlwZS5nX2luXG5cbiAgICBwaXBlLmdfaW4ucmV0dXJuKClcblxuICAgIHJldHVybiB6XG5cbiIsImltcG9ydCB7YW9fcGlwZSwgYW9faXRlciwgYW9fcnVufSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2FsayxcbiAgYXJyYXlfZnJvbV9hb19pdGVyLFxuICBpc19mbiwgaXNfZ2VuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgYW9fcGlwZScsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBsZXQgcGlwZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgYW9fcGlwZSgpXG4gICAgaXNfZ2VuIEAgcGlwZS5nX2luXG5cblxuICBkZXNjcmliZSBAICdjb21wdXRlJywgQDo6XG4gICAgaXQgQCAneGZvbGQnLCBAOjo+XG4gICAgICBsZXQgcGlwZSA9IGFvX3BpcGUgQDpcbiAgICAgICAgeHNyYzogZGVsYXlfd2FsayBAIyAzMCwyMCwxMFxuICAgICAgICB4Zm9sZDogdiA9PiAxMDAwICsgdlxuXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihwaXBlKVxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAxMDMwLCAxMDIwLCAxMDEwXG5cblxuICAgIGl0IEAgJyp4Z2ZvbGQnLCBAOjo+XG4gICAgICBsZXQgcGlwZSA9IGFvX3BpcGUgQDpcbiAgICAgICAgeHNyYzogZGVsYXlfd2FsayBAIyAzMCwyMCwxMFxuICAgICAgICAqeGdmb2xkKCkgOjpcbiAgICAgICAgICBsZXQgcyA9IDBcbiAgICAgICAgICB3aGlsZSAxIDo6XG4gICAgICAgICAgICBsZXQgdiA9IHlpZWxkIHNcbiAgICAgICAgICAgIHMgKz0gdiArIDEwMDBcblxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIocGlwZSlcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCB6LCBAW10gMTAzMCwgMjA1MCwgMzA2MFxuXG5cbiAgICBpdCBAICd4c3JjJywgQDo6PlxuICAgICAgbGV0IHBpcGUgPSBhb19waXBlIEA6XG4gICAgICAgIHhzcmM6IGRlbGF5X3dhbGsgQCMgMzAsMjAsMTBcblxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIocGlwZSlcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCB6LCBAW10gMzAsMjAsMTBcblxuXG4gICAgaXQgQCAneGN0eCcsIEA6Oj5cbiAgICAgIGxldCBsb2c9W11cblxuICAgICAgbGV0IHBpcGUgPSBhb19waXBlIEA6XG4gICAgICAgICp4Y3R4KGdfaW4pIDo6XG4gICAgICAgICAgbG9nLnB1c2ggQCAneGN0eCBzdGFydCdcbiAgICAgICAgICBsZXQgdGlkID0gc2V0VGltZW91dCBAIFxuICAgICAgICAgICAgdiA9PiBnX2luLm5leHQodilcbiAgICAgICAgICAgIDEsICdiaW5nbydcblxuICAgICAgICAgIHRyeSA6OiB5aWVsZFxuICAgICAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aWQpXG4gICAgICAgICAgICBsb2cucHVzaCBAICd4Y3R4IGZpbidcblxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIocGlwZSlcblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0J1xuXG4gICAgICBhd2FpdCBkZWxheSg1KVxuICAgICAgcGlwZS5zdG9wKClcblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0JywgJ3hjdHggZmluJ1xuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgeiwgQFtdICdiaW5nbydcblxuXG4gIGRlc2NyaWJlIEAgJ2dfaW46IHNvdXJjZSBnZW5lcmF0b3IgZmVlZCcsIEA6OlxuICAgIGl0IEAgJ3dpdGgnLCBAOjo+XG4gICAgICBsZXQgbG9nPVtdXG5cbiAgICAgIGxldCBwaXBlID0gYW9fcGlwZSgpXG5cbiAgICAgIHBpcGUuZ19pbi53aXRoX2N0eCBAXFwgZ19pbiA6OipcbiAgICAgICAgbG9nLnB1c2ggQCAnZ19pbi53aXRoIHN0YXJ0J1xuICAgICAgICBsZXQgdGlkID0gc2V0VGltZW91dCBAIFxuICAgICAgICAgIHYgPT4gZ19pbi5uZXh0KHYpXG4gICAgICAgICAgMSwgJ2JpbmdvJ1xuXG4gICAgICAgIHRyeSA6OiB5aWVsZFxuICAgICAgICBmaW5hbGx5IDo6XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRpZClcbiAgICAgICAgICBsb2cucHVzaCBAICdnX2luLndpdGggZmluJ1xuXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihwaXBlKVxuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbG9nLCBAW10gJ2dfaW4ud2l0aCBzdGFydCdcblxuICAgICAgYXdhaXQgZGVsYXkoNSlcbiAgICAgIHBpcGUuc3RvcCgpXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsb2csIEBbXSAnZ19pbi53aXRoIHN0YXJ0JywgJ2dfaW4ud2l0aCBmaW4nXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCB6LCBAW10gJ2JpbmdvJ1xuXG5cbiAgICBpdCBAICdmZWVkJywgQDo6PlxuICAgICAgbGV0IHBpcGUgPSBhb19waXBlKClcbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHBpcGUpXG5cbiAgICAgIGF3YWl0IHBpcGUuZ19pbi5mZWVkIEBcbiAgICAgICAgZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG5cbiAgICAgIHBpcGUuc3RvcCgpXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgeiwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcblxuXG4gICAgaXQgQCAnYmluZF92ZWMnLCBAOjo+XG4gICAgICBsZXQgcGlwZSA9IGFvX3BpcGUoKVxuICAgICAgbGV0IHogPSBhb19pdGVyKHBpcGUpLm5leHQoKVxuICAgICAgbGV0IHNlbmQgPSBwaXBlLmdfaW4uYmluZF92ZWMgQCAnYScsICdiJywgJ2MnXG4gICAgICBzZW5kKCdiaW5kX3ZlYycpXG5cbiAgICAgIHogPSBhd2FpdCB6XG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgei52YWx1ZSxcbiAgICAgICAgQFtdICdhJywgJ2InLCAnYycsICdiaW5kX3ZlYydcblxuXG4gICAgaXQgQCAnYmluZF9vYmonLCBAOjo+XG4gICAgICBsZXQgcGlwZSA9IGFvX3BpcGUoKVxuICAgICAgbGV0IHogPSBhb19pdGVyKHBpcGUpLm5leHQoKVxuICAgICAgbGV0IHNlbmQgPSBwaXBlLmdfaW4uYmluZF9vYmogQCAnemVkJywgQHt9XG4gICAgICAgIGE6ICdhYWEnLCBiOiAnYmJiJ1xuXG4gICAgICBzZW5kKCdiaW5kX29iaicpXG4gICAgICB6ID0gYXdhaXQgelxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHoudmFsdWUsXG4gICAgICAgIEB7fSBhOidhYWEnLCBiOidiYmInLCB6ZWQ6ICdiaW5kX29iaidcblxuXG4gIGRlc2NyaWJlIEAgJ291dHB1dCBhc3luYyBnZW5lcmF0b3InLCBAOjpcbiAgICBpdCBAICdyYXcnLCBAOjo+XG4gICAgICBsZXQgZ3MgPSBpc19nZW4gQFxuICAgICAgICBhb19waXBlIEA6XG4gICAgICAgICAgeHNyYzogZGVsYXlfd2FsayBAIyAzMCwyMCwxMFxuICAgICAgICAgIGtpbmQ6ICdyYXcnXG5cbiAgICAgIGxldCB2MCA9IGdzLm5leHQoKVxuICAgICAgZXhwZWN0KHYwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHAgPSBhb19ydW4oZ3MpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoYXdhaXQgcCkudG8uYmUudW5kZWZpbmVkXG5cbiAgICAgIGxldCB2MSA9IGdzLm5leHQoKVxuICAgICAgZXhwZWN0KHYxKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgZXhwZWN0KGF3YWl0IHYwKS50by5kZWVwLmVxdWFsIEA6IHZhbHVlOiAzMCwgZG9uZTogZmFsc2VcbiAgICAgIGV4cGVjdChhd2FpdCB2MSkudG8uZGVlcC5lcXVhbCBAOiB2YWx1ZTogdW5kZWZpbmVkLCBkb25lOiB0cnVlXG5cblxuICAgIGl0IEAgJ3RhcCcsIEA6Oj5cbiAgICAgIGxldCBncyA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgICAgYW9fcGlwZSBAOlxuICAgICAgICAgIHhzcmM6IGRlbGF5X3dhbGsgQCMgMzAsIDIwLCAxMFxuICAgICAgICAgIGtpbmQ6ICd0YXAnXG5cbiAgICAgIGxldCBhID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzLmFvX2ZvcmsoKSlcbiAgICAgIGxldCBiID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzLmFvX2ZvcmsoKSlcblxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG4gICAgICBleHBlY3QoZ3MuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgICAgZXhwZWN0KGEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KGIpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHopLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQgcCA9IGdzLmZlbmNlKClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChhd2FpdCBwKS50by5lcXVhbCBAIDMwXG5cbiAgICAgIGV4cGVjdChhd2FpdCB6KS50by5kZWVwLmVxdWFsIEAjIDMwLCAyMCwgMTBcbiAgICAgIGV4cGVjdChhd2FpdCBhKS50by5kZWVwLmVxdWFsIEAjIDMwLCAyMCwgMTBcbiAgICAgIGV4cGVjdChhd2FpdCBiKS50by5kZWVwLmVxdWFsIEAjIDMwLCAyMCwgMTBcblxuXG4gICAgaXQgQCAnc3BsaXQnLCBAOjo+XG4gICAgICBsZXQgZ3MgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICAgIGFvX3BpcGUgQDpcbiAgICAgICAgICB4c3JjOiBkZWxheV93YWxrIEAjIDMwLCAyMCwgMTBcbiAgICAgICAgICBraW5kOiAnc3BsaXQnXG5cbiAgICAgIGxldCBhID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzKVxuICAgICAgbGV0IGIgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MuYW9fZm9yaygpKVxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG5cbiAgICAgIGV4cGVjdChncy5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KGdzLmZpbikudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGV4cGVjdChhKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChiKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdCh6KS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHAgPSBncy5mZW5jZSgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoYXdhaXQgcCkudG8uZXF1YWwgQCAzMFxuXG4gICAgICBleHBlY3QoYXdhaXQgeikudG8uZGVlcC5lcXVhbCBAIyAzMCwgMjAsIDEwXG4gICAgICBleHBlY3QoYXdhaXQgYSkudG8uZGVlcC5lcXVhbCBAIyAzMCwgMjAsIDEwXG4gICAgICBleHBlY3QoYXdhaXQgYikudG8uZGVlcC5lcXVhbCBAIyAzMCwgMjAsIDEwXG5cbiIsImltcG9ydCB7YW9faW50ZXJ2YWwsIGFvX3RpbWVvdXQsIGFvX3RpbWVzLCBhb19pdGVyfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ3RpbWUnLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBpc19mbiBAIGFvX2ludGVydmFsXG4gICAgaXNfZm4gQCBhb190aW1lb3V0XG4gICAgaXNfZm4gQCBhb190aW1lc1xuXG4gIGl0IEAgJ2FvX2ludGVydmFsJywgQDo6PlxuICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX2ludGVydmFsKDEwKVxuICAgIGxldCBnID0gYW9faXRlcihhb3QpXG5cbiAgICB0cnkgOjpcbiAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgICBhc3NlcnQuZXF1YWwoMSwgdmFsdWUpXG5cbiAgICBmaW5hbGx5IDo6XG4gICAgICBnLnJldHVybigpXG5cbiAgaXQgQCAnYW9fdGltZW91dCcsIEA6Oj5cbiAgICBsZXQgYW90ID0gaXNfYXN5bmNfaXRlcmFibGUgQCBhb190aW1lb3V0KDEwKVxuICAgIGxldCBnID0gYW9faXRlcihhb3QpXG5cbiAgICB0cnkgOjpcbiAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgICBhc3NlcnQuZXF1YWwoMSwgdmFsdWUpXG5cbiAgICBmaW5hbGx5IDo6XG4gICAgICBnLnJldHVybigpXG5cbiAgaXQgQCAnYW9fdGltZXMnLCBAOjo+XG4gICAgbGV0IGcgPSBpc19nZW4gQCBhb190aW1lcyBAIGFvX2ludGVydmFsKDEwKVxuXG4gICAgdHJ5IDo6XG4gICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCB7dmFsdWU6IHRzMX0gPSBhd2FpdCBwXG4gICAgICBhc3NlcnQodHMxID49IDApXG5cbiAgICAgIGxldCB7dmFsdWU6IHRzMn0gPSBhd2FpdCBnLm5leHQoKVxuICAgICAgYXNzZXJ0KHRzMiA+PSB0czEpXG5cbiAgICBmaW5hbGx5IDo6XG4gICAgICBnLnJldHVybigpXG4iLCJpbXBvcnQge2FvX3BpcGUsIGFvX2RvbV9ldmVudHN9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuICBhcnJheV9mcm9tX2FvX2l0ZXJcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdkb20gZXZlbnRzJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19kb21fZXZlbnRzXG5cbiAgICBsZXQgZGUgPSBhb19kb21fZXZlbnRzKGFvX3BpcGUoKSlcbiAgICBpc19mbiBAIGRlLmxpc3RlblxuICAgIGlzX2ZuIEAgZGUucmVtb3ZlXG4gICAgaXNfZm4gQCBkZS5zZXRfaW5mb1xuICAgIGlzX2ZuIEAgZGUud2l0aFxuXG4gIGlmICd1bmRlZmluZWQnICE9PSB0eXBlb2YgTWVzc2FnZUNoYW5uZWwgOjpcblxuICAgIGl0IEAgJ21lc3NhZ2UgY2hhbm5lbHMnLCBAOjo+XG4gICAgICBjb25zdCB7cG9ydDEsIHBvcnQyfSA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpXG5cbiAgICAgIGNvbnN0IGFvX3RndCA9IGFvX3BpcGUoKVxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoYW9fdGd0KVxuXG4gICAgICBhb19kb21fZXZlbnRzKGFvX3RndCkud2l0aCBAOlxuICAgICAgICAkOiBAe30gdGVzdF9uYW1lOiBwb3J0MlxuICAgICAgICBtZXNzYWdlOiBldnQgPT4gZXZ0LmRhdGFcblxuICAgICAgOjohPlxuICAgICAgICBmb3IgbGV0IG0gb2YgWydhJywgJ2InLCAnYyddIDo6XG4gICAgICAgICAgcG9ydDEucG9zdE1lc3NhZ2UgQCBgZnJvbSBtc2cgcG9ydDE6ICR7bX1gXG4gICAgICAgICAgYXdhaXQgZGVsYXkoMSlcblxuICAgICAgICBhb190Z3QuZ19pbi5zdG9wKClcblxuXG4gICAgICBsZXQgZXhwZWN0ZWQgPSBAW11cbiAgICAgICAgQHt9IGRvbV9pdGVtOiAnTWVzc2FnZVBvcnQnXG4gICAgICAgICAgICBldnQ6ICdtZXNzYWdlJ1xuICAgICAgICAgICAgazogJ3Rlc3RfbmFtZSdcbiAgICAgICAgICAgIHY6ICdmcm9tIG1zZyBwb3J0MTogYSdcblxuICAgICAgICBAe30gZG9tX2l0ZW06ICdNZXNzYWdlUG9ydCdcbiAgICAgICAgICAgIGV2dDogJ21lc3NhZ2UnXG4gICAgICAgICAgICBrOiAndGVzdF9uYW1lJ1xuICAgICAgICAgICAgdjogJ2Zyb20gbXNnIHBvcnQxOiBiJ1xuXG4gICAgICAgIEB7fSBkb21faXRlbTogJ01lc3NhZ2VQb3J0J1xuICAgICAgICAgICAgZXZ0OiAnbWVzc2FnZSdcbiAgICAgICAgICAgIGs6ICd0ZXN0X25hbWUnXG4gICAgICAgICAgICB2OiAnZnJvbSBtc2cgcG9ydDE6IGMnXG5cbiAgICAgIGV4cGVjdChhd2FpdCB6KS50by5kZWVwLmVxdWFsKGV4cGVjdGVkKVxuXG4iLCJpbXBvcnQge2FvX2RvbV9hbmltYXRpb24sIGFvX3RpbWVzLCBhb19pdGVyfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2RvbSBhbmltYXRpb24gZnJhbWVzJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19kb21fYW5pbWF0aW9uXG5cbiAgaWYgJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgOjpcblxuICAgIGl0IEAgJ2FvX2RvbV9hbmltYXRpb24nLCBAOjo+XG4gICAgICBsZXQgYW90ID0gaXNfYXN5bmNfaXRlcmFibGUgQCBhb19kb21fYW5pbWF0aW9uKClcbiAgICAgIGxldCBnID0gYW9faXRlcihhb3QpXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0KHZhbHVlID49IDApXG5cbiAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgZy5yZXR1cm4oKVxuXG4gICAgaXQgQCAnYW9fdGltZXMnLCBAOjo+XG4gICAgICBsZXQgZyA9IGlzX2dlbiBAIGFvX3RpbWVzIEAgYW9fZG9tX2FuaW1hdGlvbigpXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgICBsZXQge3ZhbHVlOiB0czF9ID0gYXdhaXQgcFxuICAgICAgICBhc3NlcnQodHMxID49IDApXG5cbiAgICAgICAgbGV0IHt2YWx1ZTogdHMyfSA9IGF3YWl0IGcubmV4dCgpXG4gICAgICAgIGFzc2VydCh0czIgPj0gdHMxKVxuXG4gICAgICBmaW5hbGx5IDo6XG4gICAgICAgIGcucmV0dXJuKClcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7RUFBQSxtQ0FBbUMsTUFBTTs7O0lBSXZDLFlBQWE7TUFDWCxXQUFZLE9BQVE7OztJQUd0QixjQUFlOzs7SUFHZjtlQUNTO01BQ1A7TUFDQTs7O0lBR0YsYUFBYyxVQUFXO0lBQ3pCOzs7SUFHQTtJQUNBO0lBQ0E7SUFDQTs7O0lBR0EsT0FBUSxpQ0FBa0M7SUFDMUM7OztJQUdBO2VBQ1M7TUFDUDtJQUNGOztFQ2xDRixNQUFNO0VBQ04sRUFBRSxNQUFNLEVBQUUsV0FBVztFQUNyQixFQUFFLGdCQUFnQixFQUFFLFVBQVU7RUFDOUIsQ0FBQyxHQUFHLE1BQU0sQ0FBQztBQUNYO0VBQ0EsTUFBTTtFQUNOLEVBQUUsT0FBTyxFQUFFLFNBQVM7RUFDcEIsQ0FBQyxHQUFHLEtBQUssQ0FBQztBQUNWO0VBQ0EsTUFBTSxVQUFVLEdB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
