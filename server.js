const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const ExcelJS = require('exceljs');


const MS_TOKEN = '7b74e255c703ea5eb74c3017a8de663a594add33';

const api = axios.create({
  baseURL: 'https://api.moysklad.ru/api/remap/1.2',
  headers: {
    Authorization: `Bearer ${MS_TOKEN}`
  }
});

app.use(express.static('public'));
app.use(express.json());

app.get('/test', async (req, res) => {

    try {

        const response = await api.get(
            '/entity/productfolder?limit=5'
        );

        res.json(response.data);

    } catch (error) {

        console.error(error.response?.data || error.message);

        res.status(500).json({
            error: error.response?.data || error.message
        });
    }

});
app.get('/stats', async (req, res) => {

    try {

        const entities = [
            'customerorder',
            'purchaseorder',
            'demand',
            'supply',
            'invoiceout',
            'invoicein',
            'salesreturn',
            'purchasereturn',
            'paymentin',
            'paymentout',
            'inventory',
            'enter',
            'loss',
            'move'
        ];

        const result = {};

        for (const entity of entities) {

            try {

                const response = await api.get(
                    `/entity/${entity}?limit=1`
                );

                result[entity] =
                    response.data.meta?.size || 0;

            } catch (e) {

                result[entity] =
                    'not available';
            }
        }

        res.json(result);

    } catch (e) {

        res.status(500).json({
            error: e.message
        });
    }

});
app.get('/groupStats/:id', async (req, res) => {

    const groupId = req.params.id;

    const href =
      `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${groupId}`;

    const entities = [
        'customerorder',
        'demand',
        'invoiceout',
        'salesreturn',
        'purchaseorder',
        'supply',
        'invoicein',
        'purchasereturn'
    ];

    const result = {};

    for (const entity of entities) {

        try {

            const r = await api.get(
                `/entity/${entity}?limit=1&filter=assortment=${encodeURIComponent(href)}`
            );

            result[entity] = r.data.meta.size;

        } catch (e) {

            result[entity] = e.response?.status || 'error';
        }
    }

    res.json(result);
});

async function getAll(entity) {

    let offset = 0;
    const limit = 1000;

    let rows = [];

    while (true) {

        const response = await api.get(
            `/entity/${entity}?limit=${limit}&offset=${offset}`
        );

        rows.push(...response.data.rows);

        console.log(
            entity,
            rows.length,
            '/',
            response.data.meta.size
        );

        if (rows.length >= response.data.meta.size) {
            break;
        }

        offset += limit;
    }

    return rows;
}

app.get('/buildCatalog', async (req, res) => {

    try {

        const folders = await getAll('productfolder');
        const products = await getAll('product');

        const data = {
            folders,
            products
        };

        fs.writeFileSync(
            'catalog.json',
            JSON.stringify(data, null, 2),
            'utf8'
        );

        res.json({
            folders: folders.length,
            products: products.length
        });

    } catch (e) {

        console.error(e);

        res.status(500).json({
            error: e.message
        });
    }

});
app.get('/groupDocs/:entity/:groupId', async (req, res) => {

    try {

        const { entity, groupId } = req.params;

        const href =
            `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${groupId}`;

        let offset = 0;
        const limit = 1000;

        let rows = [];

        while (true) {

            const response = await api.get(
                `/entity/${entity}?limit=${limit}&offset=${offset}&filter=assortment=${encodeURIComponent(href)}`
            );

            rows.push(...response.data.rows);

            console.log(
                entity,
                rows.length,
                '/',
                response.data.meta.size
            );

            if (rows.length >= response.data.meta.size) {
                break;
            }

            offset += limit;
        }

        res.json({
            total: rows.length,
            rows
        });

    } catch (e) {

        console.error(e.response?.data || e.message);

        res.status(500).json({
            error: e.response?.data || e.message
        });
    }
});
app.get('/inspect/:entity/:id', async (req, res) => {

    try {

        const response = await api.get(
            `/entity/${req.params.entity}/${req.params.id}`
        );

        res.json(response.data);

    } catch (e) {

        console.error(e.response?.data || e.message);

        res.status(500).json({
            error: e.response?.data || e.message
        });
    }
});
app.get('/inspectHref', async (req, res) => {

    try {

        const href = req.query.href;

        const response = await api.get(
            href.replace(
                'https://api.moysklad.ru/api/remap/1.2',
                ''
            )
        );

        res.json(response.data);

    } catch (e) {

        console.error(e.response?.data || e.message);

        res.status(500).json({
            error: e.response?.data || e.message
        });
    }
});
app.get('/doc/:type/:id', async (req, res) => {

    try {

        const { type, id } = req.params;

        const response = await api.get(
            `/entity/${type}/${id}`
        );

        res.json(response.data);

    } catch (e) {

        res.status(500).json({
            error: e.message
        });
    }
});
app.get('/links/:groupId', async (req, res) => {

    const groupId = req.params.groupId;

    const href =
      `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${groupId}`;

    const result = {
        orders: [],
        demands: []
    };

    let offset = 0;

    while (true) {

        const r = await api.get(
            `/entity/demand?limit=1000&offset=${offset}&filter=assortment=${encodeURIComponent(href)}`
        );

        result.demands.push(
            ...r.data.rows.map(x => ({
                demandId: x.id,
                customerOrder:
                    x.customerOrder?.meta?.href || null
            }))
        );

        if (
            result.demands.length >=
            r.data.meta.size
        ) {
            break;
        }

        offset += 1000;
    }

    res.json({
        total: result.demands.length,
        sample: result.demands.slice(0, 20)
    });

});
app.get('/buildTree/:groupId', async (req, res) => {

    const groupId = req.params.groupId;

    const href =
      `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${groupId}`;

    const result = {
        customerorders: new Set(),
        demands: []
    };

    let offset = 0;

    while (true) {

        const r = await api.get(
            `/entity/demand?limit=1000&offset=${offset}&filter=assortment=${encodeURIComponent(href)}`
        );

        for (const demand of r.data.rows) {

            result.demands.push(demand.id);

            if (demand.customerOrder?.meta?.href) {

                const orderId =
                    demand.customerOrder.meta.href
                        .split('/')
                        .pop();

                result.customerorders.add(orderId);
            }
        }

        if (
            result.demands.length >=
            r.data.meta.size
        ) {
            break;
        }

        offset += 1000;
    }

    res.json({
        demands: result.demands.length,
        customerorders:
            result.customerorders.size
    });

});
app.get('/fullIndex/:groupId', async (req, res) => {

    const groupId = req.params.groupId;

    const href =
        `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${groupId}`;

    const entities = [
        'customerorder',
        'demand',
        'salesreturn',
        'invoiceout',
        'invoicein',
        'purchaseorder',
        'supply',
        'purchasereturn'
    ];

    const result = {};

    for (const entity of entities) {

        let offset = 0;
        let rows = [];

        while (true) {

            const r = await api.get(
                `/entity/${entity}?limit=1000&offset=${offset}&filter=assortment=${encodeURIComponent(href)}`
            );

            rows.push(...r.data.rows);

            if (rows.length >= r.data.meta.size) {
                break;
            }

            offset += 1000;
        }

        result[entity] = rows;

        console.log(
            entity,
            rows.length
        );
    }

    fs.writeFileSync(
        'group-index.json',
        JSON.stringify(result, null, 2)
    );

    res.json({
        saved: true
    });

});
async function getGroupCounts(groupId) {
    const href =
      `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${groupId}`;

    const demandResponse = await api.get(
        `/entity/demand?limit=1000&filter=assortment=${encodeURIComponent(href)}`
    );

    return {
        demands: demandResponse.data.meta.size
    };
}

async function buildPlanForGroup(groupId) {

  const href =
    `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${groupId}`;

  const entities = [
    'customerorder',
    'demand',
    'salesreturn',
    'invoiceout',
    'invoicein',
    'supply',
    'purchaseorder',
    'purchasereturn'
  ];

  const data = {};

  for (const entity of entities) {

    let offset = 0;
    const rows = [];

    while (true) {

      const r = await api.get(
        `/entity/${entity}?limit=1000&offset=${offset}&filter=assortment=${encodeURIComponent(href)}`
      );

      rows.push(...r.data.rows);

      if (rows.length >= r.data.meta.size) {
        break;
      }

      offset += 1000;
    }

    data[entity] = rows;

    console.log(
      groupId,
      entity,
      rows.length
    );
  }

  const paymentInIndex = JSON.parse(
    fs.readFileSync(
      'paymentin-index.json',
      'utf8'
    )
  );

  const paymentOutIndex = JSON.parse(
    fs.readFileSync(
      'paymentout-index.json',
      'utf8'
    )
  );

  const paymentins = new Set();
  const paymentouts = new Set();

  const allDocIds = new Set();

  Object.values(data).forEach(rows => {

    rows.forEach(row => {

      allDocIds.add(
        row.id
      );

    });

  });

  for (const docId of allDocIds) {

    for (
      const paymentId of
      paymentInIndex[docId] || []
    ) {

      paymentins.add(
        paymentId
      );
    }

    for (
      const paymentId of
      paymentOutIndex[docId] || []
    ) {

      paymentouts.add(
        paymentId
      );
    }
  }

  return {

    paymentin:
      [...paymentins],

    paymentout:
      [...paymentouts],

    salesreturn:
      data.salesreturn.map(
        x => x.id
      ),

    purchasereturn:
      data.purchasereturn.map(
        x => x.id
      ),

    invoiceout:
      data.invoiceout.map(
        x => x.id
      ),

    invoicein:
      data.invoicein.map(
        x => x.id
      ),

    demand:
      data.demand.map(
        x => x.id
      ),

    supply:
      data.supply.map(
        x => x.id
      ),

    purchaseorder:
      data.purchaseorder.map(
        x => x.id
      ),

    customerorder:
      data.customerorder.map(
        x => x.id
      )
  };
}
app.get('/peek', (req, res) => {

    const data = JSON.parse(
        fs.readFileSync('group-index.json', 'utf8')
    );

    res.json({
        customerorder: data.customerorder.length,
        demand: data.demand.length,
        salesreturn: data.salesreturn.length
    });
});
app.get('/analyze', (req, res) => {

    const data = JSON.parse(
        fs.readFileSync('group-index.json', 'utf8')
    );

    res.json({
        customerorders: data.customerorder.length,
        demands: data.demand.length,
        invoiceout: data.invoiceout.length,
        invoicein: data.invoicein.length,
        supply: data.supply.length,
        purchaseorder: data.purchaseorder.length,
        salesreturn: data.salesreturn.length
    });

});
app.get('/relations', (req, res) => {

    const data = JSON.parse(
        fs.readFileSync('group-index.json', 'utf8')
    );

    let demandWithOrder = 0;

    for (const d of data.demand) {

        if (d.customerOrder?.meta?.href) {
            demandWithOrder++;
        }
    }

    res.json({
        demands: data.demand.length,
        demandWithOrder
    });

});
app.get('/schema', (req, res) => {

    const data = JSON.parse(
        fs.readFileSync('group-index.json', 'utf8')
    );

    res.json({
        customerorder: Object.keys(data.customerorder[0]),
        demand: Object.keys(data.demand[0]),
        salesreturn: Object.keys(data.salesreturn[0])
    });

});
app.get('/deepSchema', (req, res) => {

    const data = JSON.parse(
        fs.readFileSync('group-index.json', 'utf8')
    );

    res.json({

        demand: {
            customerOrder:
                !!data.demand[0].customerOrder
        },

        customerorder: {
            demands:
                data.customerorder[0].demands?.length || 0
        },

        salesreturn: {
            demand:
                !!data.salesreturn[0].demand,

            payments:
                data.salesreturn[0].payments?.length || 0
        }

    });

});
app.get('/returnPaymentSample', (req, res) => {

    const data = JSON.parse(
        fs.readFileSync('group-index.json', 'utf8')
    );

    const doc = data.salesreturn.find(
        x => x.payments?.length
    );

    res.json(doc.payments);

});
app.get('/paymentDoc/:id', async (req, res) => {

    const response = await api.get(
        `/entity/paymentout/${req.params.id}`
    );

    res.json(response.data);

});
app.get('/paymentStats/:groupId', async (req, res) => {

    const groupId = req.params.groupId;

    const href =
      `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${groupId}`;

    const payments = new Set();

    let offset = 0;

    while (true) {

        const r = await api.get(
            `/entity/salesreturn?limit=1000&offset=${offset}&filter=assortment=${encodeURIComponent(href)}`
        );

        for (const salesReturn of r.data.rows) {

            if (salesReturn.payments) {

                for (const payment of salesReturn.payments) {

                    const id =
                        payment.meta.href.split('/').pop();

                    payments.add(id);
                }
            }
        }

        if (
            offset + 1000 >= r.data.meta.size
        ) {
            break;
        }

        offset += 1000;
    }

    res.json({
        payments: payments.size
    });
});
app.get('/paymentCheck/:groupId', async (req, res) => {

    const groupId = req.params.groupId;

    const href =
      `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${groupId}`;

    let totalReturns = 0;
    let returnsWithPayments = 0;

    let offset = 0;

    while (true) {

        const r = await api.get(
            `/entity/salesreturn?limit=1000&offset=${offset}&filter=assortment=${encodeURIComponent(href)}`
        );

        for (const row of r.data.rows) {

            totalReturns++;

            if (
                row.payments &&
                row.payments.length > 0
            ) {
                returnsWithPayments++;
            }
        }

        if (
            offset + 1000 >= r.data.meta.size
        ) {
            break;
        }

        offset += 1000;
    }

    res.json({
        totalReturns,
        returnsWithPayments
    });
});
app.get('/buildTreeIndex/:groupId', async (req, res) => {

    const groupId = req.params.groupId;

    const data = JSON.parse(
        fs.readFileSync('group-index.json', 'utf8')
    );

    const tree = {
        customerorders: [],
        demands: [],
        salesreturns: [],
        paymentouts: []
    };

    // customerorder
    for (const order of data.customerorder) {

        tree.customerorders.push({
            id: order.id,
            demands: order.demands?.map(
                x => x.meta.href.split('/').pop()
            ) || []
        });
    }

    // demand
    for (const demand of data.demand) {

        tree.demands.push({
            id: demand.id,
            customerOrder:
                demand.customerOrder?.meta?.href
                    ?.split('/')
                    .pop() || null
        });
    }

    // salesreturn
    for (const sr of data.salesreturn) {

        tree.salesreturns.push({
            id: sr.id,
            demand:
                sr.demand?.meta?.href
                    ?.split('/')
                    .pop() || null,

            payments:
                sr.payments?.map(
                    p => p.meta.href.split('/').pop()
                ) || []
        });
    }

    // paymentout
    const paymentIds = new Set();

    for (const sr of data.salesreturn) {

        if (!sr.payments) continue;

        for (const payment of sr.payments) {

            const id =
                payment.meta.href.split('/').pop();

            paymentIds.add(id);
        }
    }

    tree.paymentouts = [...paymentIds];

    fs.writeFileSync(
        `tree-${groupId}.json`,
        JSON.stringify(tree, null, 2)
    );

    res.json({
        customerorders: tree.customerorders.length,
        demands: tree.demands.length,
        salesreturns: tree.salesreturns.length,
        paymentouts: tree.paymentouts.length
    });
});
app.get('/treeSample', (req, res) => {

    const tree = JSON.parse(
        fs.readFileSync(
            'tree-01a94a08-956c-11ec-0a80-085a00305f3e.json',
            'utf8'
        )
    );

    res.json({
        customerorder: tree.customerorders[0],
        salesreturn: tree.salesreturns[0],
        paymentout: tree.paymentouts[0]
    });

});
app.get('/buildFinalTree', (req, res) => {

    const tree = JSON.parse(
        fs.readFileSync(
            'tree-01a94a08-956c-11ec-0a80-085a00305f3e.json',
            'utf8'
        )
    );

    const returnsByDemand = {};

    for (const r of tree.salesreturns) {

        if (!returnsByDemand[r.demand]) {
            returnsByDemand[r.demand] = [];
        }

        returnsByDemand[r.demand].push({
            id: r.id,
            payments: r.payments || []
        });
    }

    const result = [];

    for (const order of tree.customerorders) {

        const node = {
            id: order.id,
            demands: []
        };

        for (const demandId of order.demands) {

            node.demands.push({
                id: demandId,
                salesreturns:
                    returnsByDemand[demandId] || []
            });
        }

        result.push(node);
    }

    fs.writeFileSync(
        'final-tree.json',
        JSON.stringify(result, null, 2)
    );

    res.json({
        orders: result.length
    });

});
app.get('/treeStats', (req, res) => {

    const tree = JSON.parse(
        fs.readFileSync(
            'final-tree.json',
            'utf8'
        )
    );

    let orders = tree.length;
    let demands = 0;
    let returns = 0;
    let payments = 0;

    for (const order of tree) {

        for (const demand of order.demands) {

            demands++;

            returns += demand.salesreturns.length;

            for (const sr of demand.salesreturns) {
                payments += sr.payments.length;
            }
        }
    }

    res.json({
        orders,
        demands,
        returns,
        payments
    });

});
app.get('/finalSample', (req, res) => {

    const tree = JSON.parse(
        fs.readFileSync(
            'final-tree.json',
            'utf8'
        )
    );

    res.json(tree.slice(0,5));

});
app.get('/returnDemandCheck', (req, res) => {

    const tree = JSON.parse(
        fs.readFileSync(
            'tree-01a94a08-956c-11ec-0a80-085a00305f3e.json',
            'utf8'
        )
    );

    const demandIds = new Set();

    for (const order of tree.customerorders) {
        for (const demand of order.demands) {
            demandIds.add(demand);
        }
    }

    const sample = tree.salesreturns.slice(0, 20).map(r => ({
        salesreturn: r.id,
        demand: r.demand,
        exists: demandIds.has(r.demand)
    }));

    res.json(sample);

});
app.get('/debugDemand', (req, res) => {

    const tree = JSON.parse(
        fs.readFileSync(
            'tree-01a94a08-956c-11ec-0a80-085a00305f3e.json',
            'utf8'
        )
    );

    const firstReturn = tree.salesreturns[0];

    const foundOrder = tree.customerorders.find(
        order => order.demands.includes(firstReturn.demand)
    );

    res.json({
        returnDemand: firstReturn.demand,
        foundOrder
    });

});

app.get('/missingDemands', (req, res) => {
    const tree = JSON.parse(
        fs.readFileSync(
            'tree-01a94a08-956c-11ec-0a80-085a00305f3e.json',
            'utf8'
        )
    );

    const fromOrders = new Set();

    for (const order of tree.customerorders) {
        for (const demandId of order.demands) {
            fromOrders.add(demandId);
        }
    }

    const missing = tree.demands.filter(
        d => !fromOrders.has(d.id)
    );

    res.json({
        count: missing.length,
        sample: missing.slice(0,20)
    });

});
app.get('/orphanReturns', (req, res) => {

    const tree = JSON.parse(
        fs.readFileSync(
            'tree-01a94a08-956c-11ec-0a80-085a00305f3e.json',
            'utf8'
        )
    );

    const demandIdsWithOrder = new Set(
        tree.demands
            .filter(d => d.customerOrder)
            .map(d => d.id)
    );

    const orphanReturns = tree.salesreturns.filter(
        r => !demandIdsWithOrder.has(r.demand)
    );

    res.json({
        count: orphanReturns.length,
        orphanReturns
    });

});
async function bulkDelete(entity, ids) {

    if (!ids.length) return;

    const body = ids.map(id => ({
        meta: {
            href:
                `https://api.moysklad.ru/api/remap/1.2/entity/${entity}/${id}`,
            metadataHref:
                `https://api.moysklad.ru/api/remap/1.2/entity/${entity}/metadata`,
            type: entity,
            mediaType: 'application/json'
        }
    }));

    return api.post(
        `/entity/${entity}/delete`,
        body
    );
}

app.get('/inspectType/:entity', (req, res) => {

    const data = JSON.parse(
        fs.readFileSync('group-index.json','utf8')
    );

    res.json(
        Object.keys(
            data[req.params.entity][0]
        )
    );

});

app.get('/sampleIds', (req, res) => {

    const data = JSON.parse(
        fs.readFileSync('group-index.json', 'utf8')
    );

    res.json({
        supply: data.supply[0]?.id,
        purchaseorder: data.purchaseorder[0]?.id,
        invoicein: data.invoicein[0]?.id,
        invoiceout: data.invoiceout[0]?.id
    });

});
app.get('/buildDeletePlan', async (req, res) => {

  const data = JSON.parse(
    fs.readFileSync(
      'group-index.json',
      'utf8'
    )
  );

  const plan = {
    paymentout: [],
    paymentin: [],
    salesreturn: [],
    invoiceout: [],
    invoicein: [],
    demand: [],
    supply: [],
    purchaseorder: [],
    customerorder: []
  };

  const paymentins = new Set();
  const paymentouts = new Set();

  // invoiceout -> payments
  for (const invoice of data.invoiceout) {

    for (const payment of invoice.payments || []) {

      const href = payment.meta.href;
      const id = href.split('/').pop();

      if (href.includes('/paymentin/')) {
        paymentins.add(id);
      }

      if (href.includes('/paymentout/')) {
        paymentouts.add(id);
      }
    }
  }

  // invoicein -> payments
  for (const invoice of data.invoicein) {

    for (const payment of invoice.payments || []) {

      const href = payment.meta.href;
      const id = href.split('/').pop();

      if (href.includes('/paymentin/')) {
        paymentins.add(id);
      }

      if (href.includes('/paymentout/')) {
        paymentouts.add(id);
      }
    }
  }

  plan.paymentin = [...paymentins];
  plan.paymentout = [...paymentouts];

  plan.salesreturn =
    data.salesreturn.map(x => x.id);

  plan.invoiceout =
    data.invoiceout.map(x => x.id);

  plan.invoicein =
    data.invoicein.map(x => x.id);

  plan.demand =
    data.demand.map(x => x.id);

  plan.supply =
    data.supply.map(x => x.id);

  plan.purchaseorder =
    data.purchaseorder.map(x => x.id);

  plan.customerorder =
    data.customerorder.map(x => x.id);

  fs.writeFileSync(
    'delete-plan.json',
    JSON.stringify(
      plan,
      null,
      2
    )
  );

  res.json({
    paymentin: plan.paymentin.length,
    paymentout: plan.paymentout.length,
    salesreturn: plan.salesreturn.length,
    invoiceout: plan.invoiceout.length,
    invoicein: plan.invoicein.length,
    demand: plan.demand.length,
    supply: plan.supply.length,
    purchaseorder: plan.purchaseorder.length,
    customerorder: plan.customerorder.length
  });

});

app.get('/deletePlanSample', (req, res) => {

    const plan = JSON.parse(
        fs.readFileSync(
            'delete-plan.json',
            'utf8'
        )
    );

    res.json({
        paymentout: plan.paymentout.slice(0, 5),
        salesreturn: plan.salesreturn.slice(0, 5),
        invoiceout: plan.invoiceout.slice(0, 5),
        invoicein: plan.invoicein.slice(0, 5),
        demand: plan.demand.slice(0, 5),
        supply: plan.supply.slice(0, 5),
        purchaseorder: plan.purchaseorder.slice(0, 5),
        customerorder: plan.customerorder.slice(0, 5)
    });

});
async function deleteBatch(entity, ids) {

  const payload = ids.map(id => ({
    meta: {
      href: `https://api.moysklad.ru/api/remap/1.2/entity/${entity}/${id}`,
      metadataHref: `https://api.moysklad.ru/api/remap/1.2/entity/${entity}/metadata`,
      type: entity,
      mediaType: 'application/json'
    }
  }));

  const response = await api.post(
    `/entity/${entity}/delete`,
    payload
  );

  return response.data;
}
app.get('/deleteOneTest', async (req, res) => {

    const plan = JSON.parse(
        fs.readFileSync('delete-plan.json', 'utf8')
    );

    const firstPayment = plan.paymentout[0];

    const result = await deleteBatch(
        'paymentout',
        [firstPayment]
    );

    res.json(result);

});


app.get('/deleteGroupDocs', async (req, res) => {

    const order = [
  'paymentin',
  'paymentout',

  'salesreturn',

  'invoiceout',
  'invoicein',

  'demand',
  'supply',

  'purchaseorder',

  'customerorder'
];

    const result = [];

    for (const entity of order) {

        const plan = JSON.parse(
            fs.readFileSync('delete-plan.json','utf8')
        );

        const ids = plan[entity] || [];

        const batchSize = 100;

        let deleted = 0;

        for (let i = 0; i < ids.length; i += batchSize) {

            const batch =
                ids.slice(i, i + batchSize);

            try {

                await deleteBatch(entity, batch);

                deleted += batch.length;

                console.log(
                    entity,
                    deleted,
                    '/',
                    ids.length
                );

            } catch (e) {

                console.error(
                    entity,
                    e.response?.data || e.message
                );

                return res.status(500).json({
                    entity,
                    deleted,
                    error:
                        e.response?.data || e.message
                });
            }
        }

        result.push({
            entity,
            deleted
        });
    }

    res.json(result);

});
app.get('/deletePlanStats', (req,res)=>{

    const plan = JSON.parse(
        fs.readFileSync('delete-plan.json','utf8')
    );

    res.json({
        paymentout: plan.paymentout.length,
        salesreturn: plan.salesreturn.length,
        paymentin: plan.paymentin?.length || 0,
        invoiceout: plan.invoiceout.length,
        demand: plan.demand.length,
        invoicein: plan.invoicein.length,
        supply: plan.supply.length,
        purchaseorder: plan.purchaseorder.length,
        customerorder: plan.customerorder.length
    });

});

app.get('/checkPayment/:id', async (req, res) => {
  try {
    const r = await api.get(`/entity/paymentout/${req.params.id}`);
    res.json({
      exists: true,
      id: r.data.id
    });
  } catch (e) {
    if (e.response?.status === 404) {
      return res.json({
        exists: false
      });
    }

    res.status(500).json(e.response?.data || e.message);
  }
});

app.get('/checkDeletePlanPayments', async (req, res) => {
  const plan = JSON.parse(
    fs.readFileSync('delete-plan.json', 'utf8')
  );

  let exists = [];
  let missing = [];

  for (const id of plan.paymentout) {
    try {
      await api.get(`/entity/paymentout/${id}`);
      exists.push(id);
    } catch {
      missing.push(id);
    }
  }

  res.json({
    total: plan.paymentout.length,
    exists: exists.length,
    missing: missing.length
  });
});

app.get('/deleteInvoiceOutTest', async (req, res) => {
  try {
    const result = await deleteBatch(
      'invoiceout',
      ['738ca21a-46d6-11ec-0a80-003900109aac']
    );

    res.json(result);

  } catch (e) {

    res.status(500).json({
      status: e.response?.status,
      data: e.response?.data
    });

  }
});
app.get('/invoiceOutPayments', async (req, res) => {
  const data = JSON.parse(
    fs.readFileSync('group-index.json', 'utf8')
  );

  const result = [];

  for (const invoice of data.invoiceout) {

    const full = await api.get(
      `/entity/invoiceout/${invoice.id}`
    );

    result.push({
      invoice: invoice.id,
      payments: full.data.payments || []
    });
  }

  res.json(result);
});
app.get('/invoicePayments', (req,res) => {
    const data = JSON.parse(
        fs.readFileSync('group-index.json','utf8')
    );

    const paymentins = new Set();

    for(const invoice of data.invoiceout){
        if(invoice.payments){
            for(const p of invoice.payments){
                paymentins.add(
                    p.meta.href.split('/').pop()
                );
            }
        }
    }

    res.json([...paymentins]);
});

app.get('/demandOrder/:id', async (req, res) => {
  const r = await api.get(`/entity/demand/${req.params.id}`);
  res.json({
    id: r.data.id,
    customerOrder: r.data.customerOrder || null
  });
});
app.get('/deleteDemandTest', async (req, res) => {
  try {
    const result = await deleteBatch('demand', [
      'e9884432-e600-11eb-0a80-01ae00049af6'
    ]);

    res.json(result);
  } catch (e) {
    res.status(500).json({
      status: e.response?.status,
      data: e.response?.data
    });
  }
});
app.get('/deletePaymentOut/:id', async (req, res) => {
  try {
    const result = await deleteBatch(
      'paymentout',
      [req.params.id]
    );

    res.json(result);
  } catch (e) {
    res.status(500).json({
      status: e.response?.status,
      data: e.response?.data
    });
  }
});



app.get('/count/paymentout', async (req, res) => {

    const r = await api.get(
        '/entity/paymentout',
        {
            params: {
                limit: 1
            }
        }
    );

    res.json({
        total: r.data.meta.size
    });
});


app.get('/deleteOne/:entity/:id', async (req, res) => {

  try {

    const result = await deleteBatch(
      req.params.entity,
      [req.params.id]
    );

    res.json(result);

  } catch (e) {

    res.status(500).json({
      status: e.response?.status,
      data: e.response?.data
    });

  }

});

app.get('/paymentInCount', (req,res)=>{

  const data = JSON.parse(
    fs.readFileSync(
      'group-index.json',
      'utf8'
    )
  );

  let invoicesWithPayments = 0;

  for(const invoice of data.invoiceout){

    if(invoice.payments?.length){
      invoicesWithPayments++;
    }
  }

res.json({
  invoiceout: data.invoiceout.length,
  invoicesWithPayments
});
});
app.get('/inspectDemand/:id', async (req, res) => {

  const r = await api.get(
    `/entity/demand/${req.params.id}`
  );

  res.json(r.data);

});
app.get('/demandPaymentStats', (req,res)=>{

  const data = JSON.parse(
    fs.readFileSync(
      'group-index.json',
      'utf8'
    )
  );

  let count = 0;

  for(const demand of data.demand){

    if(demand.payments?.length){
      count++;
    }
  }

  res.json({
    demands: data.demand.length,
    withPayments: count
  });

});

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

const visited = new Set();

async function deleteGroupWithDependencies(groupId) {

  const key = `group:${groupId}`;

  if (visited.has(key)) {
    return;
  }

  visited.add(key);

  while (true) {

    try {

      await api.delete(
        `/entity/productfolder/${groupId}`
      );

      console.log(
        'GROUP DELETED',
        groupId
      );

      return;

    } catch (e) {

      const error =
        e.response?.data?.errors?.[0];

      if (!error) {
        throw e;
      }

      const code = error.code;

      // уже удалена
      if (code === 1021) {

        console.log(
          'GROUP ALREADY DELETED',
          groupId
        );

        return;
      }

      // rate limit
      if (code === 1049) {

        console.log(
          'RATE LIMIT GROUP',
          groupId
        );

        await sleep(2000);

        continue;
      }

      // есть зависимости
      if (code === 1028) {

        const deps =
          error.dependencies || [];

        if (!deps.length) {
          throw e;
        }

        console.log(
          'GROUP DEPENDENCIES',
          groupId,
          deps.length
        );

        for (const dep of deps) {

          const depType =
            dep.type;

          const depId =
            dep.href
              .split('/')
              .pop();

          console.log(
            'DELETE DEP',
            depType,
            depId
          );

          if (
            depType ===
            'productfolder'
          ) {

            await deleteGroupWithDependencies(
              depId
            );

          } else {

            await deleteWithDependencies(
              depType,
              depId
            );
          }
        }

        console.log(
          'RETRY GROUP',
          groupId
        );

        continue;
      }

      throw e;
    }
  }
}

async function deleteWithDependencies(entity, id) {

  const key = `${entity}:${id}`;

  if (visited.has(key)) {
    return;
  }

  visited.add(key);

  while (true) {

    try {

      await deleteBatch(entity, [id]);

      console.log(
        'DELETED',
        entity,
        id
      );

      return;

    } catch (e) {

      const data = e.response?.data;

      const error =
        data?.errors?.[0] ||
        data?.[0]?.errors?.[0];

      const code = error?.code;

      if (code === 1021) {

        console.log(
          'ALREADY DELETED',
          entity,
          id
        );

        return;
      }

      if (code === 1049) {

        console.log(
          'RATE LIMIT',
          entity,
          id
        );

        await sleep(2000);

        continue;
      }

      if (code !== 1028) {
        throw e;
      }

      const deps =
        error.dependencies || [];
if (!deps.length) {
    throw e;
}
      console.log(
        'DEPENDENCIES',
        entity,
        id,
        deps.length
      );

      for (const dep of deps) {

        const depId =
          dep.href.split('/').pop();

        console.log(
          'DELETE DEP',
          dep.type,
          depId
        );

        await deleteWithDependencies(
          dep.type,
          depId
        );
      }

      console.log(
        'RETRY',
        entity,
        id
      );
    }
  }
}
app.get('/deleteEntity/:entity', async (req, res) => {

  async function deleteOneWithRetry(entity, id) {

    while (true) {

      try {

        await deleteWithDependencies(
  entity,
  id
);

        return;

      }  catch (e) {

  const code =
    e.response?.data?.errors?.[0]?.code ||
    e.response?.data?.[0]?.errors?.[0]?.code;

  if (code === 1049) {

    console.log('RATE LIMIT', id);

    await sleep(2000);

    continue;
  }

  if (
    code === 1021 ||
    code === 3007
  ) {

    console.log('SKIP', id, code);
console.log(
  JSON.stringify(
    e.response?.data,
    null,
    2
  )
);
    return;
  }

  throw e;
}
    }
  }

  const entity = req.params.entity;

  const plan = JSON.parse(
    fs.readFileSync('delete-plan.json', 'utf8')
  );

  const ids = plan[entity] || [];

  let deleted = 0;

  for (const id of ids) {

    try {

      await deleteOneWithRetry(
        entity,
        id
      );

      deleted++;

    } catch (e) {

      const errors = e.response?.data;

      if (
        errors?.[0]?.errors?.[0]?.code === 1021
      ) {
        console.log('MISSING', id);
        continue;
      }

      console.log('FAILED', id);

      return res.json({
        id,
        error: errors
      });
    }
  }

  res.json({
    entity,
    deleted
  });

});


app.get('/rawStats', (req,res)=>{
  const data = JSON.parse(
    fs.readFileSync('group-index.json','utf8')
  );

  res.json({
    customerorder: data.customerorder.length,
    demand: data.demand.length,
    salesreturn: data.salesreturn.length,
    invoiceout: data.invoiceout.length,
    invoicein: data.invoicein.length,
    supply: data.supply.length,
    purchaseorder: data.purchaseorder.length
  });
});
app.get('/inspectPaymentIn/:id', async (req, res) => {
  try {

    const response = await api.get(
      `/entity/paymentin/${req.params.id}`
    );

    res.json(response.data);

  } catch (e) {

    res.json(
      e.response?.data || e.message
    );

  }
});
app.get('/checkFields', (req, res) => {

  const data = JSON.parse(
    fs.readFileSync(
      'group-index.json',
      'utf8'
    )
  );

  res.json({
    customerorder: Object.keys(data.customerorder[0] || {}),
    demand: Object.keys(data.demand[0] || {}),
    invoiceout: Object.keys(data.invoiceout[0] || {}),
    invoicein: Object.keys(data.invoicein[0] || {}),
    supply: Object.keys(data.supply[0] || {})
  });

});
app.get('/existsDemand/:id', async (req, res) => {

  const data = JSON.parse(
    fs.readFileSync('group-index.json','utf8')
  );

  const found = data.demand.find(
    x => x.id === req.params.id
  );

  res.json({
    existsInIndex: !!found
  });

});
app.get('/countPayments', async (req, res) => {

  const paymentIn = await api.get(
    '/entity/paymentin?limit=1'
  );

  const paymentOut = await api.get(
    '/entity/paymentout?limit=1'
  );

  res.json({
    paymentin: paymentIn.data.meta.size,
    paymentout: paymentOut.data.meta.size
  });

});
app.get('/buildPaymentinPlan', async (req, res) => {

  const paymentins = await getAll('paymentin');

  const ids = paymentins.map(x => x.id);

  fs.writeFileSync(
    'paymentin-plan.json',
    JSON.stringify(ids, null, 2)
  );

  res.json({
    total: ids.length
  });

});
app.get('/findPaymentinsForDemand/:id', async (req, res) => {

  const demandId = req.params.id;

  const paymentins = await getAll('paymentin');

  const result = [];

  for (const p of paymentins) {

    const full = await api.get(
      `/entity/paymentin/${p.id}`
    );

    const found =
      (full.data.operations || []).some(
        op =>
          op.meta?.href?.includes(
            `/demand/${demandId}`
          )
      );

    if (found) {
      result.push(p.id);
    }
  }

  res.json({
    demandId,
    count: result.length,
    paymentins: result
  });

});
app.get('/buildPaymentinIndex', async (req, res) => {

  const index = {};

  let offset = 0;
  const limit = 1000;

  let processed = 0;

  while (true) {

    const r = await api.get(
      `/entity/paymentin?limit=${limit}&offset=${offset}`
    );

    for (const payment of r.data.rows) {

      try {

        const full = await api.get(
          `/entity/paymentin/${payment.id}`
        );

        for (const op of full.data.operations || []) {

          const href = op.meta?.href;

          if (!href) {
            continue;
          }

          const operationId =
            href.split('/').pop();

          if (!index[operationId]) {
            index[operationId] = [];
          }

          index[operationId].push(
            payment.id
          );
        }

      } catch (e) {

        console.log(
          'paymentin error',
          payment.id
        );
      }

      processed++;

      if (processed % 1000 === 0) {

        console.log(
          'processed',
          processed
        );
      }
    }

    if (
      offset + r.data.rows.length >=
      r.data.meta.size
    ) {
      break;
    }

    offset += limit;
  }

  fs.writeFileSync(
    'paymentin-index.json',
    JSON.stringify(
      index,
      null,
      2
    )
  );

  res.json({
    indexedObjects:
      Object.keys(index).length,
    processedPayments:
      processed
  });

});
app.get('/paymentinSample', async (req, res) => {

  const r = await api.get(
    '/entity/paymentin?limit=1'
  );

  res.json(r.data.rows[0]);

});
app.get('/paymentinFields', async (req, res) => {

  const r = await api.get(
    '/entity/paymentin?limit=1'
  );

  res.json(
    Object.keys(
      r.data.rows[0]
    )
  );

});
app.get('/buildPaymentinPlanByGroup', async (req, res) => {

  const data = JSON.parse(
    fs.readFileSync(
      'group-index.json',
      'utf8'
    )
  );

  const demandIds = new Set(
    data.demand.map(x => x.id)
  );

  const paymentins = await getAll(
    'paymentin'
  );

  const result = [];

  for (const payment of paymentins) {

    const operations =
      payment.operations || [];

    const linked = operations.some(op => {

      const href =
        op.meta?.href || '';

      if (!href.includes('/demand/')) {
        return false;
      }

      const demandId =
        href.split('/').pop();

      return demandIds.has(
        demandId
      );
    });

    if (linked) {
      result.push(payment.id);
    }
  }

  fs.writeFileSync(
    'paymentin-plan.json',
    JSON.stringify(
      result,
      null,
      2
    )
  );

  res.json({
    totalPaymentins:
      paymentins.length,

    found:
      result.length
  });

});
app.get('/paymentinPlanStats', (req, res) => {

  const ids = JSON.parse(
    fs.readFileSync(
      'paymentin-plan.json',
      'utf8'
    )
  );

  res.json({
    total: ids.length
  });

});
app.get('/paymentinRawSample', async (req, res) => {

  const r = await api.get(
    '/entity/paymentin?limit=1'
  );

  res.json(r.data.rows[0]);

});
app.get('/deleteFoundPaymentins', async (req, res) => {

  const plan = JSON.parse(
    fs.readFileSync('paymentin-plan.json', 'utf8')
  );

  const batchSize = 100;

  let deleted = 0;

  for (let i = 0; i < plan.length; i += batchSize) {

    const batch = plan.slice(i, i + batchSize);

    try {
      await deleteBatch('paymentin', batch);

      deleted += batch.length;

      console.log(`paymentin deleted: ${deleted}/${plan.length}`);

    } catch (e) {

      console.error('ERROR batch:', e.response?.data || e.message);

      return res.status(500).json({
        deleted,
        error: e.response?.data || e.message
      });
    }
  }

  res.json({
    total: plan.length,
    deleted
  });
});
app.get('/buildGlobalPaymentIndex', async (req, res) => {

  const paymentinIndex = {};
  const paymentoutIndex = {};

  async function build(entity, target) {

    let offset = 0;
    const limit = 1000;

    while (true) {

      const r = await api.get(
        `/entity/${entity}?limit=${limit}&offset=${offset}`
      );

      for (const doc of r.data.rows) {

        if (!doc.operations) continue;

        for (const op of doc.operations) {

          const href = op.meta?.href || '';

          const id = href.split('/').pop();

          if (!id) continue;

          if (!target[id]) {
            target[id] = [];
          }

          target[id].push(doc.id);
        }
      }

      console.log(
        entity,
        offset + r.data.rows.length,
        '/',
        r.data.meta.size
      );

      if (
        offset + r.data.rows.length >=
        r.data.meta.size
      ) {
        break;
      }

      offset += limit;
    }
  }

  await build('paymentin', paymentinIndex);
  await build('paymentout', paymentoutIndex);

  fs.writeFileSync(
    'paymentin-index.json',
    JSON.stringify(paymentinIndex)
  );

  fs.writeFileSync(
    'paymentout-index.json',
    JSON.stringify(paymentoutIndex)
  );

  res.json({
    paymentin:
      Object.keys(paymentinIndex).length,

    paymentout:
      Object.keys(paymentoutIndex).length
  });

});
app.get('/buildPaymentinPlanByGroup/:groupId', (req, res) => {

  const data = JSON.parse(
    fs.readFileSync(
      'group-index.json',
      'utf8'
    )
  );

  const paymentIndex = JSON.parse(
    fs.readFileSync(
      'paymentin-index.json',
      'utf8'
    )
  );

  const paymentins = new Set();

  for (const demand of data.demand) {

    const ids =
      paymentIndex[demand.id] || [];

    for (const id of ids) {
      paymentins.add(id);
    }
  }

  const result = [...paymentins];

  fs.writeFileSync(
    'paymentin-plan.json',
    JSON.stringify(
      result,
      null,
      2
    )
  );

  res.json({
    paymentins: result.length
  });

});
app.get('/deletePaymentinPlan', async (req, res) => {

  const ids = JSON.parse(
    fs.readFileSync(
      'paymentin-plan.json',
      'utf8'
    )
  );

  let deleted = 0;

  for (let i = 0; i < ids.length; i += 100) {

    const batch =
      ids.slice(i, i + 100);

    await deleteBatch(
      'paymentin',
      batch
    );

    deleted += batch.length;

    console.log(
      deleted,
      '/',
      ids.length
    );
  }

  res.json({
    deleted
  });

});
app.get('/buildChinaGroups', (req, res) => {

  const catalog = JSON.parse(
    fs.readFileSync('catalog.json', 'utf8')
  );

  const groups = catalog.folders
    .filter(x => x.pathName === 'Китай')
    .map(x => ({
      id: x.id,
      name: x.name
    }));

  fs.writeFileSync(
    'china-groups.json',
    JSON.stringify(groups, null, 2)
  );

  res.json({
    total: groups.length
  });

});

app.get('/chinaGroupsSample', (req, res) => {

  const groups = JSON.parse(
    fs.readFileSync(
      'china-groups.json',
      'utf8'
    )
  );

  res.json({
    total: groups.length,
    sample: groups.slice(0, 20)
  });

});
app.get('/chinaStats', async (req, res) => {

  const groups = JSON.parse(
    fs.readFileSync('china-groups.json', 'utf8')
  );

  const totals = {
    customerorder: 0,
    demand: 0,
    salesreturn: 0,
    invoiceout: 0,
    invoicein: 0,
    supply: 0,
    purchaseorder: 0
  };

  for (const group of groups) {

    const href =
      `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${group.id}`;

    for (const entity of Object.keys(totals)) {

      try {

        const r = await api.get(
          `/entity/${entity}?limit=1&filter=assortment=${encodeURIComponent(href)}`
        );

        totals[entity] += r.data.meta.size;

      } catch {}
    }
  }

  res.json(totals);

});
app.get('/buildDeletePlanForGroup/:groupId', async (req, res) => {

  const groupId = req.params.groupId;

  const href =
    `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${groupId}`;

  const entities = [
    'customerorder',
    'demand',
    'salesreturn',
    'invoiceout',
    'invoicein',
    'supply',
    'purchaseorder'
  ];

  const data = {};

  for (const entity of entities) {

    let offset = 0;
    const rows = [];

    while (true) {

      const r = await api.get(
        `/entity/${entity}?limit=1000&offset=${offset}&filter=assortment=${encodeURIComponent(href)}`
      );

      rows.push(...r.data.rows);

      if (rows.length >= r.data.meta.size) {
        break;
      }

      offset += 1000;
    }

    data[entity] = rows;

    console.log(
      entity,
      rows.length
    );
  }

  const paymentInIndex = JSON.parse(
    fs.readFileSync(
      'paymentin-index.json',
      'utf8'
    )
  );

  const paymentOutIndex = JSON.parse(
    fs.readFileSync(
      'paymentout-index.json',
      'utf8'
    )
  );

  const paymentins = new Set();
  const paymentouts = new Set();

  function collect(index, ids, target) {

    for (const id of ids) {

      const payments =
        index[id] || [];

      for (const paymentId of payments) {
        target.add(paymentId);
      }
    }
  }

  collect(
    paymentInIndex,
    data.customerorder.map(x => x.id),
    paymentins
  );

  collect(
    paymentInIndex,
    data.invoiceout.map(x => x.id),
    paymentins
  );

  collect(
    paymentInIndex,
    data.demand.map(x => x.id),
    paymentins
  );

  collect(
    paymentOutIndex,
    data.salesreturn.map(x => x.id),
    paymentouts
  );

  collect(
    paymentOutIndex,
    data.invoicein.map(x => x.id),
    paymentouts
  );

  collect(
    paymentOutIndex,
    data.supply.map(x => x.id),
    paymentouts
  );

  const plan = {

    paymentin:
      [...paymentins],

    paymentout:
      [...paymentouts],

    salesreturn:
      data.salesreturn.map(x => x.id),

    invoiceout:
      data.invoiceout.map(x => x.id),

    invoicein:
      data.invoicein.map(x => x.id),

    demand:
      data.demand.map(x => x.id),

    supply:
      data.supply.map(x => x.id),

    purchaseorder:
      data.purchaseorder.map(x => x.id),

    customerorder:
      data.customerorder.map(x => x.id)
  };

  fs.writeFileSync(
    `plan-${groupId}.json`,
    JSON.stringify(
      plan,
      null,
      2
    )
  );

  res.json({
    paymentin: plan.paymentin.length,
    paymentout: plan.paymentout.length,
    salesreturn: plan.salesreturn.length,
    invoiceout: plan.invoiceout.length,
    invoicein: plan.invoicein.length,
    demand: plan.demand.length,
    supply: plan.supply.length,
    purchaseorder: plan.purchaseorder.length,
    customerorder: plan.customerorder.length
  });

});
app.get('/paymentinIndexSample', (req, res) => {

  const index = JSON.parse(
    fs.readFileSync(
      'paymentin-index.json',
      'utf8'
    )
  );

  const firstKey =
    Object.keys(index)[0];

  res.json({
    firstKey,
    value: index[firstKey]
  });

});
app.get('/checkDemandsInPaymentIndex/:groupId', async (req, res) => {

  const groupId = req.params.groupId;

  const data = JSON.parse(
    fs.readFileSync('group-index.json', 'utf8')
  );

  const paymentIndex = JSON.parse(
    fs.readFileSync('paymentin-index.json', 'utf8')
  );

  let found = 0;

  for (const demand of data.demand) {

    if (paymentIndex[demand.id]) {
      found++;
    }
  }

  res.json({
    demands: data.demand.length,
    demandsWithPaymentin: found
  });

});
app.get('/buildDeletePlansForChina', async (req, res) => {

  const groups = JSON.parse(
    fs.readFileSync(
      'china-groups.json',
      'utf8'
    )
  );

  const summary = [];

  for (const group of groups) {

    try {

      const plan =
        await buildPlanForGroup(
          group.id
        );

      fs.writeFileSync(
        `plan-${group.id}.json`,
        JSON.stringify(
          plan,
          null,
          2
        )
      );

      summary.push({
        id: group.id,
        name: group.name,

        paymentin:
          plan.paymentin.length,

        paymentout:
          plan.paymentout.length,

        salesreturn:
          plan.salesreturn.length,

        invoiceout:
          plan.invoiceout.length,

        invoicein:
          plan.invoicein.length,

        demand:
          plan.demand.length,

        supply:
          plan.supply.length,

        purchaseorder:
          plan.purchaseorder.length,

        customerorder:
          plan.customerorder.length
      });

      console.log(
        'PLAN',
        group.name
      );

    } catch (e) {

      console.log(
        'FAILED',
        group.name
      );

      summary.push({
        id: group.id,
        name: group.name,
        error:
          e.response?.data ||
          e.message
      });
    }
  }

  fs.writeFileSync(
    'china-delete-summary.json',
    JSON.stringify(
      summary,
      null,
      2
    )
  );

  res.json({
    groups:
      groups.length
  });

});
app.get('/deleteEntityFromPlan/:groupId/:entity', async (req, res) => {
 visited.clear();
  const { groupId, entity } = req.params;

  const plan = JSON.parse(
    fs.readFileSync(
      `plan-${groupId}.json`,
      'utf8'
    )
  );

  const ids = plan[entity] || [];

  let deleted = 0;

  for (const id of ids) {

    try {

     await deleteWithDependencies(
  entity,
  id
);

      deleted++;

    } catch (e) {

      return res.status(500).json({
        id,
        error: e.response?.data || e.message
      });
    }
  }

  res.json({
    entity,
    deleted
  });

});
app.get('/deleteGroupPaymentins/:groupId', async (req, res) => {

  const groupId = req.params.groupId;

  const plan = JSON.parse(
    fs.readFileSync(
      `plan-${groupId}.json`,
      'utf8'
    )
  );

  const ids = plan.paymentin || [];

  let deleted = 0;

  const batchSize = 100;

  for (let i = 0; i < ids.length; i += batchSize) {

    const batch =
      ids.slice(i, i + batchSize);

    try {

      const started = Date.now();

      await deleteBatch(
        'paymentin',
        batch
      );

      console.log(
        'paymentin batch time',
        Date.now() - started,
        'ms'
      );

      deleted += batch.length;

      console.log(
        `paymentin ${deleted}/${ids.length}`
      );

    } catch (e) {

      const errors =
        e.response?.data || [];

      const allMissing =
        Array.isArray(errors) &&
        errors.length > 0 &&
        errors.every(
          x =>
            x.errors?.[0]?.code === 1021
        );

      if (allMissing) {

        deleted += batch.length;

        console.log(
          `paymentin: batch already deleted ${deleted}/${ids.length}`
        );

        continue;
      }

      console.log(
        'paymentin batch failed, switching to single delete'
      );

      for (const id of batch) {

        try {

          await deleteBatch(
            'paymentin',
            [id]
          );

          deleted++;

        } catch (e2) {

          const code =
            e2.response?.data?.errors?.[0]?.code ||
            e2.response?.data?.[0]?.errors?.[0]?.code;

          if (code === 1021) {

            deleted++;

            continue;
          }

          if (code === 3007) {

            console.log(
              'SKIP 3007',
              id
            );

            deleted++;

            continue;
          }

          if (code === 1049) {

            console.log(
              'RATE LIMIT',
              id
            );

            await sleep(3000);

            try {

              await deleteBatch(
                'paymentin',
                [id]
              );

              deleted++;

              continue;

            } catch (retryError) {

              return res.status(500).json({
                deleted,
                failed: id,
                error:
                  retryError.response?.data ||
                  retryError.message
              });
            }
          }

          return res.status(500).json({
            deleted,
            failed: id,
            error:
              e2.response?.data ||
              e2.message
          });
        }
      }
    }
  }

  res.json({
    total: ids.length,
    deleted
  });

});


app.get('/deleteGroupDemands/:groupId', async (req, res) => {

  const groupId = req.params.groupId;

  const plan = JSON.parse(
    fs.readFileSync(
      `plan-${groupId}.json`,
      'utf8'
    )
  );

  const ids = plan.demand || [];

  let deleted = 0;

  const batchSize = 100;

  for (let i = 0; i < ids.length; i += batchSize) {

    const batch =
      ids.slice(i, i + batchSize);

    try {

      const started = Date.now();

      await deleteBatch(
        'demand',
        batch
      );

      console.log(
        'demand batch time',
        Date.now() - started,
        'ms'
      );

      deleted += batch.length;

      console.log(
        `demand ${deleted}/${ids.length}`
      );

    } catch (e) {

      const errors =
        e.response?.data || [];

      const allMissing =
        Array.isArray(errors) &&
        errors.length > 0 &&
        errors.every(
          x => x.errors?.[0]?.code === 1021
        );

      if (allMissing) {

        deleted += batch.length;

        console.log(
          `demand: batch already deleted ${deleted}/${ids.length}`
        );

        continue;
      }

      console.log(
        'demand batch failed, switching to single delete'
      );

      for (const id of batch) {

        try {

          await deleteBatch(
            'demand',
            [id]
          );

          deleted++;

        } catch (e2) {

          const code =
            e2.response?.data?.errors?.[0]?.code ||
            e2.response?.data?.[0]?.errors?.[0]?.code;

          if (code === 1021) {

            deleted++;

            continue;
          }

          if (code === 1049) {

            console.log(
              'RATE LIMIT',
              id
            );

            await sleep(3000);

            i--;

            continue;
          }

          if (code === 1028) {

            try {

              await deleteWithDependencies(
                'demand',
                id
              );

              deleted++;

              continue;

            } catch (depError) {

              return res.status(500).json({
                deleted,
                failed: id,
                error:
                  depError.response?.data ||
                  depError.message
              });
            }
          }

          return res.status(500).json({
            deleted,
            failed: id,
            error:
              e2.response?.data ||
              e2.message
          });
        }
      }
    }
  }

  res.json({
    total: ids.length,
    deleted
  });

});
app.get('/deleteGroupSalesReturns/:groupId', async (req, res) => {

  const plan = JSON.parse(
    fs.readFileSync(
      `plan-${req.params.groupId}.json`,
      'utf8'
    )
  );

  const ids = plan.salesreturn || [];

  let deleted = 0;

  for (let i = 0; i < ids.length; i += 100) {

    const batch = ids.slice(i, i + 100);

    await deleteBatch(
      'salesreturn',
      batch
    );

    deleted += batch.length;

    console.log(
      `salesreturn ${deleted}/${ids.length}`
    );
  }

  res.json({
    total: ids.length,
    deleted
  });

});
app.get('/deleteGroupSupplies/:groupId', async (req, res) => {

  const groupId = req.params.groupId;

  const plan = JSON.parse(
    fs.readFileSync(
      `plan-${groupId}.json`,
      'utf8'
    )
  );

  const ids = plan.supply || [];

  let deleted = 0;

  const batchSize = 100;

  for (let i = 0; i < ids.length; i += batchSize) {

    const batch =
      ids.slice(i, i + batchSize);

    try {

      await deleteBatch(
        'supply',
        batch
      );

      deleted += batch.length;

      console.log(
        `supply ${deleted}/${ids.length}`
      );

    } catch (e) {

      console.log(
        'supply batch failed, switching to single delete'
      );

      for (const id of batch) {

        try {

          await deleteBatch(
            'supply',
            [id]
          );

          deleted++;

        } catch (e2) {

          const code =
            e2.response?.data?.errors?.[0]?.code ||
            e2.response?.data?.[0]?.errors?.[0]?.code;

          if (code === 1021) {

            console.log(
              'already deleted',
              id
            );

            continue;
          }
if (code === 3007) {

  console.log(
    'SKIP 3007',
    id
  );

  continue;
}
          if (code === 1049) {

  await sleep(3000);

  try {

    await deleteBatch(
      'demand',
      [id]
    );

    deleted++;

  } catch (retryError) {

    return res.status(500).json({
      deleted,
      failed: id,
      error:
        retryError.response?.data ||
        retryError.message
    });
  }

  continue;
}

          return res.json({
            deleted,
            failed: id,
            error: e2.response?.data
          });
        }
      }
    }
  }

  res.json({
    total: ids.length,
    deleted
  });

});
app.get('/deleteGroupPurchaseOrders/:groupId', async (req, res) => {

  const groupId = req.params.groupId;

  const plan = JSON.parse(
    fs.readFileSync(
      `plan-${groupId}.json`,
      'utf8'
    )
  );

  const ids =
    plan.purchaseorder || [];

  let deleted = 0;

  for (let i = 0; i < ids.length; i += 100) {

    const batch =
      ids.slice(i, i + 100);

    try {

      await deleteBatch(
        'purchaseorder',
        batch
      );

      deleted += batch.length;

      console.log(
        `purchaseorder ${deleted}/${ids.length}`
      );

    } catch (e) {

      const code =
        e.response?.data?.errors?.[0]?.code ||
        e.response?.data?.[0]?.errors?.[0]?.code;

      if (code === 1049) {

        console.log('RATE LIMIT');

        await sleep(2000);

        i -= 100;

        continue;
      }

      console.log(
        JSON.stringify(
          e.response?.data,
          null,
          2
        )
      );

      return res.status(500).json({
        deleted,
        error:
          e.response?.data || e.message
      });
    }
  }

  res.json({
    total: ids.length,
    deleted
  });

});
app.get('/deleteGroupCustomerOrders/:groupId', async (req, res) => {

  visited.clear();

  const groupId = req.params.groupId;

  const plan = JSON.parse(
    fs.readFileSync(
      `plan-${groupId}.json`,
      'utf8'
    )
  );

  const ids =
    plan.customerorder || [];

  let deleted = 0;

  for (const id of ids) {

    try {

      await deleteWithDependencies(
        'customerorder',
        id
      );

      deleted++;

      console.log(
        `customerorder ${deleted}/${ids.length}`
      );

    } catch (e) {

      return res.status(500).json({
        deleted,
        failed: id,
        error:
          e.response?.data || e.message
      });
    }
  }

  res.json({
    total: ids.length,
    deleted
  });

});

app.get('/deleteGroup/:id', async (req, res) => {

  try {

    visited.clear();

    await deleteGroupWithDependencies(
      req.params.id
    );

    res.json({
      deleted: true,
      groupId: req.params.id
    });

  } catch (e) {

    console.log(
      JSON.stringify(
        e.response?.data,
        null,
        2
      )
    );

    res.status(500).json({
      status:
        e.response?.status,

      error:
        e.response?.data ||
        e.message
    });
  }
});
app.get('/deleteAllChinaGroups', async (req, res) => {

  const groups = JSON.parse(
    fs.readFileSync(
      'china-groups.json',
      'utf8'
    )
  );

  const deleted = [];
  const failed = [];

  for (const group of groups) {

    try {

      await api.delete(
        `/entity/productfolder/${group.id}`
      );

      deleted.push({
        id: group.id,
        name: group.name
      });

      console.log(
        'DELETED GROUP',
        group.name
      );

      await sleep(300);

    } catch (e) {

      console.log(
        'FAILED GROUP',
        group.name
      );

      failed.push({
        id: group.id,
        name: group.name,
        error:
          e.response?.data || e.message
      });
    }
  }

  res.json({
    total: groups.length,
    deleted: deleted.length,
    failed: failed.length,
    failedGroups: failed
  });

});
app.get('/paymentoutIndexSample', (req, res) => {

  const index = JSON.parse(
    fs.readFileSync(
      'paymentout-index.json',
      'utf8'
    )
  );

  const firstKey = Object.keys(index)[0];

  res.json({
    firstKey,
    value: index[firstKey]
  });

});
app.get('/findCustomerOrderPayments', async (req, res) => {

  let offset = 0;
  const limit = 1000;

  const found = [];

  while (true) {

    const r = await api.get(
      `/entity/paymentin?limit=${limit}&offset=${offset}`
    );

    for (const payment of r.data.rows) {

      try {

        const full = await api.get(
          `/entity/paymentin/${payment.id}`
        );

        const hasOrder =
          (full.data.operations || []).some(
            op => op.meta?.type === 'customerorder'
          );

        if (hasOrder) {

          found.push({
            paymentin: payment.id
          });

          if (found.length >= 20) {
            return res.json(found);
          }
        }

      } catch {}
    }

    if (
      offset + r.data.rows.length >=
      r.data.meta.size
    ) {
      break;
    }

    offset += limit;
  }

  res.json(found);
});
app.get('/deleteGroupByPlan/:groupId', async (req, res) => {

  visited.clear();

  const groupId = req.params.groupId;

  const plan = JSON.parse(
    fs.readFileSync(
      `plan-${groupId}.json`,
      'utf8'
    )
  );

  const order = [
    'paymentin',
    'paymentout',
    'salesreturn',
    'invoiceout',
    'invoicein',
    'demand',
    'supply',
    'purchaseorder',
    'customerorder'
  ];

  const result = [];

  for (const entity of order) {

    const ids = plan[entity] || [];

    let deleted = 0;

    console.log(
      `START ${entity}: ${ids.length}`
    );

    for (let i = 0; i < ids.length; i += 100) {

      const batch =
        ids.slice(i, i + 100);

      try {

        await deleteBatch(
          entity,
          batch
        );

        deleted += batch.length;

      } catch (e) {

  const errors =
    e.response?.data || [];

  const onlyIgnorable =
  Array.isArray(errors) &&
  errors.length > 0 &&
  errors.every(item => {

    if (item.info) {
      return true;
    }

    const code =
      item.errors?.[0]?.code;

    return code === 1021;
  });
const codes = errors.map(
  x => x.errors?.[0]?.code
).filter(Boolean);

console.log(
  'ERROR CODES',
  [...new Set(codes)]
);
if (onlyIgnorable) {

  deleted += batch.length;

  console.log(
    `paymentin: batch processed ${deleted}/${ids.length}`
  );

  continue;
}

  console.log(
    `${entity}: batch failed -> single delete`
  );

  for (const id of batch) {

    try {

      await deleteBatch(
        entity,
        [id]
      );

      deleted++;

    } catch (e2) {

      const code =
        e2.response?.data?.errors?.[0]?.code ||
        e2.response?.data?.[0]?.errors?.[0]?.code;

      if (code === 1021) {

        deleted++;

        continue;
      }

     if (code === 3007) {

  try {

    await deleteWithDependencies(
      entity,
      id
    );

    deleted++;

    continue;

  } catch (depError) {

    return res.status(500).json({
      entity,
      deleted,
      failedId: id,
      error:
        depError.response?.data ||
        depError.message
    });
  }
}
      if (code === 1049) {

        await sleep(3000);

        continue;
      }

      return res.status(500).json({
        entity,
        deleted,
        failedId: id,
        error:
          e2.response?.data ||
          e2.message
      });
    }
  }
}
      console.log(
        `${entity}: ${deleted}/${ids.length}`
      );
    }

    result.push({
      entity,
      deleted,
      total: ids.length
    });

    console.log(
      `DONE ${entity}: ${deleted}/${ids.length}`
    );
  }

  try {

    await deleteGroupWithDependencies(
      groupId
    );

  } catch (e) {

    console.log(
      'GROUP DELETE ERROR',
      e.response?.data || e.message
    );
  }

  res.json({
    success: true,
    result
  });

});
app.get('/deleteAllChinaByPlans', async (req, res) => {

  const groups = JSON.parse(
    fs.readFileSync(
      'china-groups.json',
      'utf8'
    )
  );

  const result = [];

  for (const group of groups) {

    try {

      console.log(
        'START',
        group.name
      );

      // удалить всё из плана
      await axios.get(
        `http://localhost:3000/deleteGroupByPlan/${group.id}`
      );

      // удалить папку
      await deleteGroupWithDependencies(
        group.id
      );

      result.push({
        group: group.name,
        status: 'deleted'
      });

    } catch (e) {

      result.push({
        group: group.name,
        status: 'failed',
        error:
          e.response?.data ||
          e.message
      });
    }
  }

  res.json(result);

});
async function buildPlanForGroup(groupId) {

  const href =
    `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${groupId}`;

  const entities = [
    'customerorder',
    'demand',
    'salesreturn',
    'invoiceout',
    'invoicein',
    'supply',
    'purchaseorder',
    'purchasereturn'
  ];

  const data = {};

  for (const entity of entities) {

    let offset = 0;
    const rows = [];

    while (true) {

      const r = await api.get(
        `/entity/${entity}?limit=1000&offset=${offset}&filter=assortment=${encodeURIComponent(href)}`
      );

      rows.push(...r.data.rows);

      if (rows.length >= r.data.meta.size) {
        break;
      }

      offset += 1000;
    }

    data[entity] = rows;

    console.log(
      groupId,
      entity,
      rows.length
    );
  }

  return {

    salesreturn:
      data.salesreturn.map(
        x => x.id
      ),

    purchasereturn:
      data.purchasereturn.map(
        x => x.id
      ),

    invoiceout:
      data.invoiceout.map(
        x => x.id
      ),

    invoicein:
      data.invoicein.map(
        x => x.id
      ),

    demand:
      data.demand.map(
        x => x.id
      ),

    supply:
      data.supply.map(
        x => x.id
      ),

    purchaseorder:
      data.purchaseorder.map(
        x => x.id
      ),

    customerorder:
      data.customerorder.map(
        x => x.id
      )
  };
}
app.get('/buildDeletePlansForChina', async (req, res) => {

  const groups = JSON.parse(
    fs.readFileSync(
      'china-groups.json',
      'utf8'
    )
  );

  const summary = [];

  for (const group of groups) {

    try {

      const plan =
        await buildPlanForGroup(
          group.id
        );

      fs.writeFileSync(
        `plan-${group.id}.json`,
        JSON.stringify(
          plan,
          null,
          2
        )
      );

      summary.push({
        id: group.id,
        name: group.name,

        salesreturn:
          plan.salesreturn.length,

        purchasereturn:
          plan.purchasereturn.length,

        invoiceout:
          plan.invoiceout.length,

        invoicein:
          plan.invoicein.length,

        demand:
          plan.demand.length,

        supply:
          plan.supply.length,

        purchaseorder:
          plan.purchaseorder.length,

        customerorder:
          plan.customerorder.length
      });

      console.log(
        'PLAN',
        group.name
      );

    } catch (e) {

      console.log(
        'FAILED',
        group.name
      );

      summary.push({
        id: group.id,
        name: group.name,
        error:
          e.response?.data ||
          e.message
      });
    }
  }

  fs.writeFileSync(
    'china-delete-summary.json',
    JSON.stringify(
      summary,
      null,
      2
    )
  );

  res.json({
    groups: groups.length,
    built: summary.length
  });

});
app.get('/buildGlobalCustomerOrders', async (req, res) => {

  const groups = JSON.parse(
    fs.readFileSync(
      'china-groups.json',
      'utf8'
    )
  );

  const orders = new Set();

  for (const group of groups) {

    console.log(
      'GROUP',
      group.name,
      group.id
    );

    const href =
      `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${group.id}`;

    let offset = 0;
    let groupCount = 0;

    while (true) {

      const r = await api.get(
        `/entity/customerorder?limit=1000&offset=${offset}&filter=assortment=${encodeURIComponent(href)}`
      );

      for (const row of r.data.rows) {
        orders.add(row.id);
      }

      groupCount += r.data.rows.length;

      if (
        offset + r.data.rows.length >=
        r.data.meta.size
      ) {
        break;
      }

      offset += 1000;
    }

    console.log(
      group.name,
      'customerorders',
      groupCount,
      'total',
      orders.size
    );
  }

  fs.writeFileSync(
    'global-customerorders.json',
    JSON.stringify(
      [...orders],
      null,
      2
    )
  );

  res.json({
    customerorders: orders.size
  });

});
app.get('/buildGlobalDemands', async (req, res) => {

  const groups = JSON.parse(
    fs.readFileSync(
      'china-groups.json',
      'utf8'
    )
  );

  const demands = new Set();

  for (const group of groups) {

    console.log(
      'GROUP',
      group.name,
      group.id
    );

    const href =
      `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${group.id}`;

    let offset = 0;
    let groupCount = 0;

    while (true) {

      const r = await api.get(
        `/entity/demand?limit=1000&offset=${offset}&filter=assortment=${encodeURIComponent(href)}`
      );

      for (const row of r.data.rows) {
        demands.add(row.id);
      }

      groupCount += r.data.rows.length;

      if (
        offset + r.data.rows.length >=
        r.data.meta.size
      ) {
        break;
      }

      offset += 1000;
    }

    console.log(
      group.name,
      'demands',
      groupCount,
      'total',
      demands.size
    );
  }

  fs.writeFileSync(
    'global-demands.json',
    JSON.stringify(
      [...demands],
      null,
      2
    )
  );

  res.json({
    demands: demands.size
  });

});
app.get('/deleteGlobalDemands', async (req, res) => {

  const ids = JSON.parse(
    fs.readFileSync(
      'global-demands.json',
      'utf8'
    )
  );

  let deleted = 0;

  for (let i = 0; i < ids.length; i += 100) {

    const batch =
      ids.slice(i, i + 100);

    try {

      await deleteBatch(
        'demand',
        batch
      );

      deleted += batch.length;

    } catch {

      continue;
    }

    if (deleted % 1000 === 0) {

      console.log(
        `demand ${deleted}/${ids.length}`
      );
    }
  }

  res.json({
    total: ids.length,
    deleted
  });

});
app.get('/deleteGlobalCustomerOrders', async (req, res) => {

  const ids = JSON.parse(
    fs.readFileSync(
      'global-customerorders.json',
      'utf8'
    )
  );

  let deleted = 0;

  for (let i = 0; i < ids.length; i += 100) {

    const batch =
      ids.slice(i, i + 100);

    try {

      await deleteBatch(
        'customerorder',
        batch
      );

      deleted += batch.length;

    } catch {

      continue;
    }

    if (deleted % 1000 === 0) {

      console.log(
        `customerorder ${deleted}/${ids.length}`
      );
    }
  }

  res.json({
    total: ids.length,
    deleted
  });

});
app.get('/deleteChinaDemandsAndOrders', async (req, res) => {

  visited.clear();

  const groups = JSON.parse(
    fs.readFileSync(
      'china-groups.json',
      'utf8'
    )
  );

  const demands = new Set();
  const orders = new Set();

  for (const group of groups) {

    const href =
      `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${group.id}`;

    for (const entity of [
      'demand',
      'customerorder'
    ]) {

      let offset = 0;

      while (true) {

        const r = await api.get(
          `/entity/${entity}?limit=1000&offset=${offset}&filter=assortment=${encodeURIComponent(href)}`
        );

        for (const row of r.data.rows) {

          if (entity === 'demand') {
            demands.add(row.id);
          } else {
            orders.add(row.id);
          }
        }

        if (
          offset + r.data.rows.length >=
          r.data.meta.size
        ) {
          break;
        }

        offset += 1000;
      }
    }
  }

  async function remove(entity, ids) {

    let deleted = 0;

    const list = [...ids];

    for (let i = 0; i < list.length; i += 100) {

      const batch =
        list.slice(i, i + 100);

      try {

        await deleteBatch(
          entity,
          batch
        );

        deleted += batch.length;

      } catch {

        for (const id of batch) {

          try {

            await deleteBatch(
              entity,
              [id]
            );

            deleted++;

          } catch (e2) {

            const code =
              e2.response?.data?.errors?.[0]?.code ||
              e2.response?.data?.[0]?.errors?.[0]?.code;

            if (
              code === 1021
            ) {

              deleted++;

              continue;
            }

            if (
              code === 3007 ||
              code === 1028
            ) {

              try {

                await deleteWithDependencies(
                  entity,
                  id
                );

                deleted++;

              } catch {}

              continue;
            }

            if (
              code === 1049
            ) {

              await sleep(2000);

              continue;
            }
          }
        }
      }

      if (deleted % 1000 === 0) {

        console.log(
          `${entity}: ${deleted}/${list.length}`
        );
      }
    }

    return deleted;
  }

  const deletedDemands =
    await remove(
      'demand',
      demands
    );

  const deletedOrders =
    await remove(
      'customerorder',
      orders
    );

  res.json({
    demands: demands.size,
    deletedDemands,
    customerorders: orders.size,
    deletedOrders
  });

});
app.get('/deleteChinaDemands', async (req, res) => {

  const groups = JSON.parse(
    fs.readFileSync(
      'china-groups.json',
      'utf8'
    )
  );

  const demands = new Set();

  for (const group of groups) {

    console.log(
      'SCAN',
      group.name
    );

    const href =
      `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${group.id}`;

    let offset = 0;

    while (true) {

      const r = await api.get(
        `/entity/demand?limit=1000&offset=${offset}&filter=assortment=${encodeURIComponent(href)}`
      );

      for (const row of r.data.rows) {
        demands.add(row.id);
      }

      if (
        offset + r.data.rows.length >=
        r.data.meta.size
      ) {
        break;
      }

      offset += 1000;
    }

    console.log(
      group.name,
      'total demands',
      demands.size
    );
  }

  const ids = [...demands];

  console.log(
    'FOUND DEMANDS',
    ids.length
  );

  let deleted = 0;

  for (let i = 0; i < ids.length; i += 100) {

    const batch =
      ids.slice(i, i + 100);

    try {

      await deleteBatch(
        'demand',
        batch
      );

      deleted += batch.length;

    } catch (e) {

      const errors =
        e.response?.data || [];

      const onlyIgnorable =
        Array.isArray(errors) &&
        errors.length > 0 &&
        errors.every(item => {

          if (item.info) {
            return true;
          }

          const code =
            item.errors?.[0]?.code;

          return (
            code === 1021 ||
            code === 3007
          );
        });

      if (onlyIgnorable) {

        deleted += batch.length;

        continue;
      }

      console.log(
        JSON.stringify(
          errors,
          null,
          2
        )
      );

      for (const id of batch) {

        try {

          await deleteBatch(
            'demand',
            [id]
          );

          deleted++;

        } catch (e2) {

          const code =
            e2.response?.data?.errors?.[0]?.code ||
            e2.response?.data?.[0]?.errors?.[0]?.code;

          if (
            code === 1021 ||
            code === 3007
          ) {

            deleted++;

            continue;
          }

          if (code === 1028) {

            try {

              await deleteWithDependencies(
                'demand',
                id
              );

              deleted++;

            } catch {}

            continue;
          }

          console.log(
            'FAILED DEMAND',
            id,
            code
          );
        }
      }
    }

    if (deleted % 1000 === 0) {

      console.log(
        `demand ${deleted}/${ids.length}`
      );
    }
  }

  res.json({
    found: ids.length,
    deleted
  });

});
app.get('/deleteChinaMoves', async (req, res) => {

  const groups = JSON.parse(
    fs.readFileSync(
      'china-groups.json',
      'utf8'
    )
  );

  const moves = new Set();

  for (const group of groups) {

    console.log(
      'SCAN',
      group.name
    );

    const href =
      `https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${group.id}`;

    let offset = 0;

    while (true) {

      const r = await api.get(
        `/entity/move?limit=1000&offset=${offset}&filter=assortment=${encodeURIComponent(href)}`
      );

      for (const row of r.data.rows) {
        moves.add(row.id);
      }

      if (
        offset + r.data.rows.length >=
        r.data.meta.size
      ) {
        break;
      }

      offset += 1000;
    }

    console.log(
      group.name,
      'total moves',
      moves.size
    );
  }

  const ids = [...moves];

  console.log(
    'FOUND MOVES',
    ids.length
  );

  let deleted = 0;

  for (let i = 0; i < ids.length; i += 100) {

    const batch =
      ids.slice(i, i + 100);

    try {

      await deleteBatch(
        'move',
        batch
      );

      deleted += batch.length;

    } catch (e) {

      const errors =
        e.response?.data || [];

      const onlyIgnorable =
        Array.isArray(errors) &&
        errors.length > 0 &&
        errors.every(item => {

          if (item.info) {
            return true;
          }

          const code =
            item.errors?.[0]?.code;

          return (
            code === 1021 ||
            code === 3007
          );
        });

      if (onlyIgnorable) {

        deleted += batch.length;

        continue;
      }

      console.log(
        JSON.stringify(
          errors,
          null,
          2
        )
      );

      for (const id of batch) {

        try {

          await deleteBatch(
            'move',
            [id]
          );

          deleted++;

        } catch (e2) {

          const code =
            e2.response?.data?.errors?.[0]?.code ||
            e2.response?.data?.[0]?.errors?.[0]?.code;

          if (
            code === 1021 ||
            code === 3007
          ) {

            deleted++;

            continue;
          }

          console.log(
            'FAILED MOVE',
            id,
            code
          );
        }
      }
    }

    if (deleted % 1000 === 0) {

      console.log(
        `move ${deleted}/${ids.length}`
      );
    }
  }

  res.json({
    found: ids.length,
    deleted
  });

});
app.get('/paymentoutSample', async (req, res) => {

  const r = await api.get(
    '/entity/paymentout/3d74baf6-634e-11f1-0a80-1119003a3b65?expand=operations'
  );

  console.log(
    JSON.stringify(
      r.data,
      null,
      2
    )
  );

  res.json({
    ok: true
  });

});
app.get('/restorePaymentOutFromInvoiceIn', async (req, res) => {

  let offset = 0;

  let created = 0;
  let skippedState = 0;
  let skippedExists = 0;
  let failed = 0;

  const expenseItem = {
    meta: {
      href:
        'https://api.moysklad.ru/api/remap/1.2/entity/expenseitem/8dcf5b24-0a01-11e4-bb69-002590a32f46',
      type:
        'expenseitem',
      mediaType:
        'application/json'
    }
  };

  while (true) {

    const r = await api.get(
      `/entity/invoicein?limit=1000&offset=${offset}&expand=payments,state`
    );

    for (const invoice of r.data.rows) {

      if (
        invoice.state?.name === 'На оплату'
      ) {

        skippedState++;

        continue;
      }

      if (
        Array.isArray(invoice.payments) &&
        invoice.payments.length > 0
      ) {

        skippedExists++;

        continue;
      }

      try {

        await api.post(
          '/entity/paymentout',
          {
            organization:
              invoice.organization,

            agent:
              invoice.agent,

            expenseItem,

            sum:
              invoice.sum,

            moment:
              invoice.moment,

            operations: [
              {
                meta: {
                  href:
                    `https://api.moysklad.ru/api/remap/1.2/entity/invoicein/${invoice.id}`,
                  type:
                    'invoicein',
                  mediaType:
                    'application/json'
                }
              }
            ]
          }
        );

        created++;

        if (created % 100 === 0) {

          console.log(
            `CREATED ${created}`
          );
        }

      } catch (e) {

        failed++;

        console.log(
          'FAILED',
          invoice.name,
          invoice.id
        );

        console.log(
          JSON.stringify(
            e.response?.data || {},
            null,
            2
          )
        );
      }
    }

    console.log(
      `SCAN ${Math.min(offset + r.data.rows.length, r.data.meta.size)}/${r.data.meta.size} CREATED ${created} EXISTS ${skippedExists} STATE ${skippedState} FAILED ${failed}`
    );

    if (
      offset + r.data.rows.length >=
      r.data.meta.size
    ) {
      break;
    }

    offset += 1000;
  }

  res.json({
    created,
    skippedExists,
    skippedState,
    failed
  });

});
app.get('/expenseItems', async (req, res) => {

  const r = await api.get(
    '/entity/expenseitem'
  );

  res.json(
    r.data.rows.map(x => ({
      id: x.id,
      name: x.name
    }))
  );

});
app.get('/testCreatePaymentOut', async (req, res) => {

  const invoiceId =
    '005c96fc-386f-11eb-0a80-097300284ae2';

  const invoice = (
    await api.get(
      `/entity/invoicein/${invoiceId}`
    )
  ).data;

  try {

    const r = await api.post(
      '/entity/paymentout',
      {
        organization:
          invoice.organization,

        agent:
          invoice.agent,

        expenseItem: {
          meta: {
            href:
              'https://api.moysklad.ru/api/remap/1.2/entity/expenseitem/8dcf5b24-0a01-11e4-bb69-002590a32f46',
            type:
              'expenseitem',
            mediaType:
              'application/json'
          }
        },

        sum:
          invoice.sum,

        moment:
          invoice.moment,

        operations: [
          {
            meta: {
              href:
                `https://api.moysklad.ru/api/remap/1.2/entity/invoicein/${invoice.id}`,
              type:
                'invoicein',
              mediaType:
                'application/json'
            }
          }
        ]
      }
    );

    res.json(r.data);

  } catch (e) {

    console.log(
      JSON.stringify(
        e.response?.data || e.message,
        null,
        2
      )
    );

    res.json(
      e.response?.data || {
        error: e.message
      }
    );
  }

});
app.get('/deleteAllSalesReturns', async (req, res) => {

  const ids = [];

  let offset = 0;

  while (true) {

    let page;

    while (true) {

      try {

        page = await api.get(
          `/entity/salesreturn?limit=1000&offset=${offset}`
        );

        break;

      } catch {

        console.log(
          'RETRY SCAN',
          offset
        );

        await sleep(3000);
      }
    }

    ids.push(
      ...page.data.rows.map(
        x => x.id
      )
    );

    console.log(
      `scan ${ids.length}/${page.data.meta.size}`
    );

    if (
      offset + page.data.rows.length >=
      page.data.meta.size
    ) {
      break;
    }

    offset += 1000;
  }

  console.log(
    'FOUND SALESRETURNS',
    ids.length
  );

  const CONCURRENCY = 20;

  let processed = 0;

  const tasks = [];

  for (let i = 0; i < ids.length; i += 100) {

    tasks.push(
      deleteBatch(
        'salesreturn',
        ids.slice(i, i + 100)
      )
    );

    processed += 100;

    if (tasks.length >= CONCURRENCY) {

      const results =
        await Promise.allSettled(
          tasks
        );

      tasks.length = 0;

      const rateLimited =
        results.some(r => {

          if (
            r.status !== 'rejected'
          ) {
            return false;
          }

          const text =
            JSON.stringify(
              r.reason?.response?.data || {}
            );

          return text.includes(
            '1049'
          );
        });

      if (rateLimited) {

        console.log(
          'RATE LIMIT'
        );

        await sleep(2000);
      }

      console.log(
        `salesreturn ${Math.min(processed, ids.length)}/${ids.length}`
      );
    }
  }

  if (tasks.length) {

    await Promise.allSettled(
      tasks
    );
  }

  res.json({
    total: ids.length
  });

});
app.get('/buildWbOzonDemands', async (req, res) => {

  const agents = [
    'ООО "ВАЙЛДБЕРРИЗ"',
    'ООО "ИНТЕРНЕТ РЕШЕНИЯ"'
  ];

  const ids = new Set();

  for (const name of agents) {

    const cp = await api.get(
      `/entity/counterparty?search=${encodeURIComponent(name)}`
    );

    const agent =
      cp.data.rows.find(
        x => x.name === name
      );

    if (!agent) {

      console.log(
        'NOT FOUND',
        name
      );

      continue;
    }

    const href =
      `https://api.moysklad.ru/api/remap/1.2/entity/counterparty/${agent.id}`;

    let offset = 0;

    while (true) {

      const r = await api.get(
        `/entity/demand?limit=1000&offset=${offset}&filter=agent=${encodeURIComponent(href)}`
      );

      for (const row of r.data.rows) {
        ids.add(row.id);
      }

      console.log(
        name,
        offset + r.data.rows.length,
        '/',
        r.data.meta.size
      );

      if (
        offset + r.data.rows.length >=
        r.data.meta.size
      ) {
        break;
      }

      offset += 1000;
    }
  }

  fs.writeFileSync(
    'wb-ozon-demands.json',
    JSON.stringify(
      [...ids],
      null,
      2
    )
  );

  res.json({
    demands: ids.size
  });

});
app.get('/deleteWbOzonDemands', async (req, res) => {

  const ids = JSON.parse(
    fs.readFileSync(
      'wb-ozon-demands.json',
      'utf8'
    )
  );

  const BATCH_SIZE = 1000;
  const CONCURRENCY = 5;

  let processed = 0;

  for (
    let i = 0;
    i < ids.length;
    i += BATCH_SIZE * CONCURRENCY
  ) {

    const tasks = [];

    for (
      let j = i;
      j < Math.min(
        i + BATCH_SIZE * CONCURRENCY,
        ids.length
      );
      j += BATCH_SIZE
    ) {

      tasks.push(
        deleteBatch(
          'demand',
          ids.slice(
            j,
            j + BATCH_SIZE
          )
        ).catch(() => {})
      );
    }

    await Promise.allSettled(
      tasks
    );

    processed += Math.min(
      BATCH_SIZE * CONCURRENCY,
      ids.length - i
    );

    console.log(
      `demand ${processed}/${ids.length}`
    );
  }

  console.log(
    'DONE',
    processed
  );

  res.json({
    total: ids.length,
    processed
  });

});
const WB_TOKEN ='eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjYwMzAydjEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjMsImVudCI6MSwiZXhwIjoxNzk1ODE3NTIwLCJmb3IiOiJzZWxmIiwiaWQiOiIwMTllNzMzOC0yOTMyLTcyZTQtOWJiMy0wNTQ0OTA3OTdiOTEiLCJpaWQiOjExNzcyNzc0LCJvaWQiOjEyOTk2MSwicyI6ODE2NjIsInNpZCI6IjljYmM3N2U3LWNjMzEtNDgwMC1hMzk2LWYxZmViZjM2MjEyZSIsInQiOmZhbHNlLCJ1aWQiOjExNzcyNzc0fQ.FSug6W66Kdm_ej_1o8lpkDYhSjbTDM2GceayIDb-nocwDXVllJWkb0d89TAXp6_Gz-FyYh4-puiDuAJfpZE6yA'





app.get('/wb/campaigns', async (req, res) => {
const response = await fetch(
  'https://advert-api.wildberries.ru/api/advert/v2/adverts',
  {
    method: 'GET',
    headers: {
      Authorization: WB_TOKEN
    }
  }
);

const data = await response.json();
const campaign = data.adverts.find(x => x.id === 22994457);

console.dir(campaign, {
  depth: null,
  colors: true
});

});
app.get('/wb/documents', async (req, res) => {
  try {
    const response = await fetch(
      'https://documents-api.wildberries.ru/api/v1/documents/categories?locale=ru',
      {
        method: 'GET',
        headers: {
          Authorization: WB_TOKEN
        }
      }
    );

    const data = await response.json();

    console.log(JSON.stringify(data, null, 2));

    res.json(data);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});

// Получить статистику кампании
app.get('/wb/campaign/:id', async (req, res) => {
  try {
    const advertId = Number(req.params.id);

    const response = await fetch(
      'https://advert-api.wildberries.ru/api/advert/v2/adverts',
      {
        method: 'POST',
        headers: {
          Authorization: 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjYwMzAydjEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjMsImVudCI6MSwiZXhwIjoxNzk1ODE3NTIwLCJmb3IiOiJzZWxmIiwiaWQiOiIwMTllNzMzOC0yOTMyLTcyZTQtOWJiMy0wNTQ0OTA3OTdiOTEiLCJpaWQiOjExNzcyNzc0LCJvaWQiOjEyOTk2MSwicyI6ODE2NjIsInNpZCI6IjljYmM3N2U3LWNjMzEtNDgwMC1hMzk2LWYxZmViZjM2MjEyZSIsInQiOmZhbHNlLCJ1aWQiOjExNzcyNzc0fQ.FSug6W66Kdm_ej_1o8lpkDYhSjbTDM2GceayIDb-nocwDXVllJWkb0d89TAXp6_Gz-FyYh4-puiDuAJfpZE6yA',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([advertId])
      }
    );

    const data = await response.json();

    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});



app.get('/wb/campaign/:id/nm-costs', async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    const response = await fetch(
      'https://advert-api.wildberries.ru/adv/v3/fullstats',
      {
        method: 'POST',
        headers: {
          Authorization: WB_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([
          {
            id: Number(id),
            dates: [from, to]
          }
        ])
      }
    );

    const stats = await response.json();

    const result = {};

    for (const campaign of stats) {
      for (const day of campaign.days || []) {
        for (const app of day.apps || []) {
          for (const nm of app.nm || []) {
            const nmId = nm.nmId;

            result[nmId] = {
              nmId,
              spend:
                (result[nmId]?.spend || 0) +
                (nm.sum || 0)
            };
          }
        }
      }
    }

    res.json(Object.values(result));
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message
    });
  }
});
app.get('/wb/documents/list', async (req, res) => {
  try {
    const params = new URLSearchParams({
      locale: 'ru',
      limit: '50',
      offset: '0',
      sort: 'date',
      order: 'desc'
    });

    const response = await fetch(
      `https://documents-api.wildberries.ru/api/v1/documents/list?${params}`,
      {
        method: 'GET',
        headers: {
          Authorization: WB_TOKEN
        }
      }
    );

    const data = await response.json();

    console.log(JSON.stringify(data, null, 2));

    res.json(data);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});
app.get('/wb/document/299993539', async (req, res) => {
  try {
    const response = await fetch(
      'https://documents-api.wildberries.ru/api/v1/documents/download?serviceName=upd-299993539&extension=zip',
      {
        headers: {
          Authorization: WB_TOKEN
        }
      }
    );

    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="upd-299993539.zip"'
    );

    res.send(buffer);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get('/wb/document-info/:serviceName', async (req, res) => {
  try {
    const response = await fetch(
      `https://documents-api.wildberries.ru/api/v1/documents/download?serviceName=${req.params.serviceName}&extension=zip`,
      {
        headers: {
          Authorization: WB_TOKEN
        }
      }
    );

    const data = await response.json();

    console.log(JSON.stringify(data, null, 2));

    res.json(data);

  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: e.message
    });
  }
});
app.get('/wb/documents/actprofit', async (req, res) => {
  try {
    const params = new URLSearchParams({
      locale: 'ru',
      category: 'actprofit',
      limit: '50',
      offset: '0'
    });

    const response = await fetch(
      `https://documents-api.wildberries.ru/api/v1/documents/list?${params}`,
      {
        headers: {
          Authorization: WB_TOKEN
        }
      }
    );

    const data = await response.json();

    console.log(JSON.stringify(data, null, 2));
    console.log(response.status);
console.log(response.headers.get('content-type'));

    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
app.get('/wb/actprofit/view', async (req, res) => {
  try {
    const response = await fetch(
      'https://documents-api.wildberries.ru/api/v1/documents/download?serviceName=actprofit-267558616&extension=zip',
      {
        headers: {
          Authorization: WB_TOKEN
        }
      }
    );

    const data = await response.json();

    console.log(JSON.stringify(data, null, 2));

    res.json(data);

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
app.get('/wb/actprofit/download', async (req, res) => {
  try {
    const response = await fetch(
      'https://documents-api.wildberries.ru/api/v1/documents/download?serviceName=actprofit-267558616&extension=zip',
      {
        headers: {
          Authorization: WB_TOKEN
        }
      }
    );

    const data = await response.json();

    const zipBuffer = Buffer.from(
      data.data.document,
      'base64'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${data.data.fileName}"`
    );

    res.setHeader(
      'Content-Type',
      'application/zip'
    );

    res.send(zipBuffer);

  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: e.message
    });
  }
});
app.get('/wb/advert-costs', async (req, res) => {
  try {
    const response = await fetch(
      'https://advert-api.wildberries.ru/adv/v1/upd?from=2025-05-24&to=2025-05-31',
      {
        headers: {
          Authorization: WB_TOKEN
        }
      }
    );

    const data = await response.json();

    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
app.get('/wb/upd-products/:updNum', async (req, res) => {
  try {
    const { updNum } = req.params;

    const from = req.query.from;
    const to = req.query.to;

    const updResponse = await fetch(
      `https://advert-api.wildberries.ru/adv/v1/upd?from=${from}&to=${to}`,
      {
        headers: {
          Authorization: WB_TOKEN
        }
      }
    );

    const updData = await updResponse.json();

    const updRows = updData.filter(
      row => String(row.updNum) === String(updNum)
    );

    const advertIds = [
      ...new Set(updRows.map(row => row.advertId))
    ];

    const productsMap = {};

    for (const advertId of advertIds) {

      const campaignSpend = updRows
        .filter(row => row.advertId === advertId)
        .reduce((sum, row) => sum + Number(row.updSum || 0), 0);

      const statsResponse = await fetch(
        'https://advert-api.wildberries.ru/adv/v3/fullstats',
        {
          method: 'POST',
          headers: {
            Authorization: WB_TOKEN,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([
            {
              id: advertId,
              dates: [from, to]
            }
          ])
        }
      );

      const statsData = await statsResponse.json();

      const campaignProducts = [];

      let campaignNmSum = 0;

      for (const campaign of statsData || []) {
        for (const day of campaign.days || []) {
          for (const app of day.apps || []) {
            for (const nm of app.nm || []) {

              campaignNmSum += Number(nm.sum || 0);

              campaignProducts.push({
                nmId: nm.nmId,
                spendInStats: Number(nm.sum || 0)
              });
            }
          }
        }
      }

      for (const product of campaignProducts) {

        const share =
          campaignNmSum > 0
            ? product.spendInStats / campaignNmSum
            : 0;

        const allocatedSpend =
          campaignSpend * share;

        if (!productsMap[product.nmId]) {
          productsMap[product.nmId] = {
            nmId: product.nmId,
            totalAdSpend: 0
          };
        }

        productsMap[product.nmId].totalAdSpend += allocatedSpend;
      }
    }

    const products = Object.values(productsMap)
      .sort((a, b) => b.totalAdSpend - a.totalAdSpend);

    const totalSpend = products.reduce(
      (sum, p) => sum + p.totalAdSpend,
      0
    );

    res.json({
      updNum,
      from,
      to,
      totalSpend: Number(totalSpend.toFixed(2)),
      products: products.map(p => ({
        nmId: p.nmId,
        adSpend: Number(p.totalAdSpend.toFixed(2))
      }))
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: e.message
    });
  }
});
app.get('/wb/debug/25379467', async (req, res) => {
  try {
    const response = await fetch(
      'https://advert-api.wildberries.ru/adv/v3/fullstats',
      {
        method: 'POST',
        headers: {
          Authorization: WB_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([
          {
            id: 25379467,
            dates: [
              '2025-05-24',
              '2025-05-31'
            ]
          }
        ])
      }
    );

    const data = await response.json();

    console.dir(data, { depth: null });

    res.json(data);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get('/wb/advert-costs2', async (req, res) => {
  try {
    const updNum = 241820035;

    const response = await fetch(
      'https://advert-api.wildberries.ru/adv/v1/upd?from=2025-05-24&to=2025-05-31',
      {
        headers: {
          Authorization: WB_TOKEN
        }
      }
    );

    const data = await response.json();

    const rows = data.filter(
      x => Number(x.updNum) === updNum
    );

    const result = {};

    for (const row of rows) {
      const campName = row.campName;

      if (!result[campName]) {
        result[campName] = {
          campName,
          advertId: row.advertId,
          spend: 0
        };
      }

      result[campName].spend += Number(row.updSum || 0);
    }

    res.json(
      Object.values(result)
        .sort((a, b) => b.spend - a.spend)
    );

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});


app.get('/wb/advert-costs3', async (req, res) => {
  try {
    const updNum = 301205660;

    const response = await fetch(
      'https://advert-api.wildberries.ru/adv/v1/upd?from=2026-05-31&to=2026-06-07',
      {
        headers: {
          Authorization: WB_TOKEN
        }
      }
    );

    const data = await response.json();


    const rows = data.filter(
      x => Number(x.updNum) === updNum
    );

    const campaigns = {};

    for (const row of rows) {
      const campName = row.campName;

      if (!campaigns[campName]) {
        campaigns[campName] = {
          campName,
          advertId: row.advertId,
          spend: 0
        };
      }

      campaigns[campName].spend += Number(row.updSum || 0);
    }

    const result = Object.values(campaigns)
      .sort((a, b) => b.spend - a.spend);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Campaigns');

    sheet.columns = [
      { header: 'Кампания', key: 'campName', width: 50 },
      { header: 'Advert ID', key: 'advertId', width: 15 },
      { header: 'Расход', key: 'spend', width: 15 }
    ];

    result.forEach(row => {
      sheet.addRow(row);
    });

    sheet.addRow([]);

    sheet.addRow({
      campName: 'ИТОГО',
      spend: result.reduce((sum, x) => sum + x.spend, 0)
    });

    const fileName = `advert-costs-${updNum}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );

    await workbook.xlsx.write(res);

    res.end();

  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: e.message
    });
  }
});
app.get('/wb/paid-storage-test', async (req, res) => {
  try {

    const dateFrom = '2025-05-01';
    const dateTo = '2025-05-08';

    // 1. Создаем отчет
    const createResponse = await fetch(
      `https://seller-analytics-api.wildberries.ru/api/v1/paid_storage?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      {
        headers: {
          Authorization: WB_TOKEN
        }
      }
    );

    const createData = await createResponse.json();

    console.log('CREATE:', createData);

    const taskId = createData?.data?.taskId;

    if (!taskId) {
      return res.status(500).json(createData);
    }

    // 2. Ждем готовности
    let status = '';

    while (status !== 'done') {

      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await fetch(
        `https://seller-analytics-api.wildberries.ru/api/v1/paid_storage/tasks/${taskId}/status`,
        {
          headers: {
            Authorization: WB_TOKEN
          }
        }
      );

      const statusData = await statusResponse.json();

      console.log('STATUS:', statusData);

      status = statusData?.data?.status;

      if (status === 'error') {
        return res.status(500).json(statusData);
      }
    }

    // 3. Скачиваем отчет
    const downloadResponse = await fetch(
      `https://seller-analytics-api.wildberries.ru/api/v1/paid_storage/tasks/${taskId}/download`,
      {
        headers: {
          Authorization: WB_TOKEN
        }
      }
    );

    const report = await downloadResponse.json();

    console.dir(report, { depth: null });

    res.json(report);

  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: e.message
    });
  }
});


app.get('/wb/paid-storage-report', async (req, res) => {
  try {

    const dateFrom = '2026-06-01';
    const dateTo = '2026-06-07';

    // =========================
    // Создаем отчет
    // =========================

    const createResponse = await fetch(
      `https://seller-analytics-api.wildberries.ru/api/v1/paid_storage?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      {
        headers: {
          Authorization: WB_TOKEN
        }
      }
    );

    const createData = await createResponse.json();

    if (!createResponse.ok) {
      return res.status(createResponse.status).json(createData);
    }

    const taskId = createData?.data?.taskId;

    if (!taskId) {
      return res.status(500).json(createData);
    }

    console.log('TASK:', taskId);

    // =========================
    // Ждем готовности
    // =========================

    let status = '';

    while (status !== 'done') {

      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await fetch(
        `https://seller-analytics-api.wildberries.ru/api/v1/paid_storage/tasks/${taskId}/status`,
        {
          headers: {
            Authorization: WB_TOKEN
          }
        }
      );

      const statusData = await statusResponse.json();

      if (!statusResponse.ok) {
        return res.status(statusResponse.status).json(statusData);
      }

      status = statusData?.data?.status;

      console.log('STATUS:', status);

      if (status === 'error') {
        return res.status(500).json(statusData);
      }
    }

    // =========================
    // Скачиваем отчет
    // =========================

    const downloadResponse = await fetch(
      `https://seller-analytics-api.wildberries.ru/api/v1/paid_storage/tasks/${taskId}/download`,
      {
        headers: {
          Authorization: WB_TOKEN
        }
      }
    );

    const report = await downloadResponse.json();

    if (!downloadResponse.ok) {
      return res.status(downloadResponse.status).json(report);
    }

    if (!Array.isArray(report)) {
      return res.status(500).json({
        error: 'WB вернул не массив',
        wbResponse: report
      });
    }

    // сохраняем сырой отчет
    fs.writeFileSync(
      `paid-storage-raw-${dateFrom}-${dateTo}.json`,
      JSON.stringify(report, null, 2)
    );

    // =========================
    // Группировка
    // =========================

    const grouped = {};

    for (const row of report) {

      const key = row.nmId;

      if (!grouped[key]) {
        grouped[key] = {
          nmId: row.nmId,
          vendorCode: row.vendorCode,
          subject: row.subject,
          brand: row.brand,
          records: 0,
          storageCost: 0
        };
      }

      grouped[key].records += 1;
      grouped[key].storageCost += Number(row.warehousePrice || 0);
    }

    const result = Object.values(grouped)
      .map(item => ({
        ...item,
        storageCost: Number(item.storageCost.toFixed(2))
      }))
      .sort((a, b) => b.storageCost - a.storageCost);

    const totalStorage = Number(
      result.reduce(
        (sum, item) => sum + item.storageCost,
        0
      ).toFixed(2)
    );

    // =========================
    // Excel
    // =========================

    const workbook = new ExcelJS.Workbook();

    const sheet = workbook.addWorksheet('Платное хранение');

    sheet.columns = [
      {
        header: 'nmId',
        key: 'nmId',
        width: 15
      },
      {
        header: 'vendorCode',
        key: 'vendorCode',
        width: 30
      },
      {
        header: 'subject',
        key: 'subject',
        width: 25
      },
      {
        header: 'brand',
        key: 'brand',
        width: 20
      },
      {
        header: 'records',
        key: 'records',
        width: 12
      },
      {
        header: 'storageCost',
        key: 'storageCost',
        width: 15
      }
    ];

    sheet.getRow(1).font = {
      bold: true
    };

    result.forEach(row => {
      sheet.addRow(row);
    });

    sheet.addRow([]);

    sheet.addRow({
      vendorCode: 'ИТОГО',
      storageCost: totalStorage
    });

    sheet.autoFilter = {
      from: 'A1',
      to: 'F1'
    };

    const fileName =
      `paid-storage-${dateFrom}-${dateTo}.xlsx`;

    await workbook.xlsx.writeFile(fileName);

    res.json({
      success: true,
      taskId,
      rows: result.length,
      totalStorage,
      file: fileName,
      rawFile: `paid-storage-raw-${dateFrom}-${dateTo}.json`
    });

  } catch (e) {

    console.error(e);

    res.status(500).json({
      error: e.message
    });

  }
});
app.get('/wb/acquiring-test', async (req, res) => {
  try {

    const response = await fetch(
  'https://finance-api.wildberries.ru/api/finance/v1/acquiring/detailed',
  {
    method: 'POST',
    headers: {
      Authorization: WB_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      dateFrom: '2026-06-11',
      dateTo: '2026-06-17',
      limit: 10,
      rrdId: 0
    })
  }
);

const text = await response.text();

console.log('STATUS', response.status);
console.log(text);

res.send(text);

  } catch (e) {

    console.error(e);

    res.status(500).json({
      error: e.message
    });

  }
});
app.get('/buildWbOzonPaymentinPlan', async (req, res) => {

  const agents = [
    'ООО "ВАЙЛДБЕРРИЗ"',
    'ООО "ИНТЕРНЕТ РЕШЕНИЯ"'
  ];

  const ids = new Set();

  for (const name of agents) {

    const cp = await api.get(
      `/entity/counterparty?search=${encodeURIComponent(name)}`
    );

    const agent =
      cp.data.rows.find(
        x => x.name === name
      );

    if (!agent) {

      console.log(
        'NOT FOUND',
        name
      );

      continue;
    }

    const href =
      `https://api.moysklad.ru/api/remap/1.2/entity/counterparty/${agent.id}`;

    let offset = 0;

    while (true) {

      let r;

      while (true) {

        try {

          r = await api.get(
            `/entity/paymentin?limit=1000&offset=${offset}&filter=agent=${encodeURIComponent(href)}`
          );

          break;

        } catch {

          console.log(
            'RETRY',
            name,
            offset
          );

          await sleep(3000);
        }
      }

      for (const row of r.data.rows) {
        ids.add(row.id);
      }

      console.log(
        name,
        offset + r.data.rows.length,
        '/',
        r.data.meta.size
      );

      if (
        offset + r.data.rows.length >=
        r.data.meta.size
      ) {
        break;
      }

      offset += 1000;
    }
  }

  fs.writeFileSync(
    'wb-ozon-paymentin.json',
    JSON.stringify(
      [...ids],
      null,
      2
    )
  );

  console.log(
    'TOTAL',
    ids.size
  );

  res.json({
    paymentin: ids.size
  });

});
app.get('/deleteWbOzonPaymentin', async (req, res) => {
const CONCURRENCY = 5;
const BATCH_SIZE = 1000;
  const ids = JSON.parse(
    fs.readFileSync(
      'wb-ozon-paymentin.json',
      'utf8'
    )
  );

  const tasks = [];

  let sent = 0;

  for (
    let i = 0;
    i < ids.length;
    i += BATCH_SIZE
  ) {

    tasks.push(
      deleteBatch(
        'paymentin',
        ids.slice(
          i,
          i + BATCH_SIZE
        )
      ).catch(() => {})
    );

    sent += BATCH_SIZE;

    if (
      tasks.length >= 5
    ) {

      await Promise.allSettled(
        tasks
      );

      tasks.length = 0;

      console.log(
        `sent ${Math.min(sent, ids.length)}/${ids.length}`
      );
    }
  }

  await Promise.allSettled(
    tasks
  );

  res.json({
    total: ids.length
  });

});

app.listen(3000, () => {
    console.log('Server started: http://localhost:3000');
}); 

