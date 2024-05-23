const express = require('express');
const app = express();
app.use(express.json());
const db = require('../models');
const {baseModelbo} = require("./basebo");


class ivr_menu   extends baseModelbo {
    constructor() {

        super("ivr_menus", "ivr_menu_id");
        this.baseModal = "ivr_menus";
        this.primaryKey = "ivr_menu_id"
    }

  getIvrMenuByCampaignId(req, res, next) {
        const campaignId = req.body.campaignId;
        const stepNumber = req.body.stepNumber - 1;
        const extension = req.body.extension

        db.ivr_menus.findOne({
            where: { campaign_id: campaignId, active: 'Y', extension: extension }
        }).then(ivrMenu => {
            if (!ivrMenu) {
                return res.status(404).json({ error: `🚩There is no campaign with campaign ID ${campaignId}🚩.` });
            }

            const flowData = ivrMenu.flow;
            if (!flowData) {
                return res.status(404).json({ error: `🚩No flow data found for campaign with campaign ID ${campaignId}🚩.` });
            }

            const nodes = flowData.nodes;
            const edges = flowData.edges;

            // Fonction pour trier les nœuds par leur profondeur dans l'arborescence
            function trierParProfondeur(edges) {
                const graph = {};
                edges.forEach(edge => {
                    if (!graph[edge.source]) {
                        graph[edge.source] = { id: edge.source, children: [] };
                    }
                    if (!graph[edge.target]) {
                        graph[edge.target] = { id: edge.target, children: [] };
                    }
                    graph[edge.source].children.push(graph[edge.target]);
                });

                const visit = (node, level, result) => {
                    if (!result[level]) {
                        result[level] = [];
                    }
                    result[level].push(node.id);
                    node.children.forEach(child => {
                        visit(child, level + 1, result);
                    });
                };

                const result = [];
                visit(graph["1"], 0, result);
                return result;
            }

            // Fonction pour afficher les nœuds d'ordre de niveau impair
            function afficherNiveauxImpairs(sortedNodes) {
                const nodesByStep = [];
                sortedNodes.forEach((nodes, level) => {
                    if (level % 2 == 0) {
                        nodesByStep.push(nodes);
                    }
                });
                return nodesByStep;
            }

            const sortedNodes = trierParProfondeur(edges);
            const nodesByStep = afficherNiveauxImpairs(sortedNodes);

            console.log("nodesByStep", nodesByStep);
            console.log("Taille de nodesByStep: ", nodesByStep.length);

            // Nouvelle fonction pour récupérer le parent et les enfants en fonction de step
            function trouverParentEtEnfants(step, nodesByStep) {
                if (step < nodesByStep.length) {
                    const nodes = nodesByStep[step];
                    const nodeInfos = nodes.map(node => {
                        const parentNode = trouverParent(node, edges);
                        const childrenNodes = trouverEnfants(node, edges);
                        return { node: node, parent: parentNode, enfants: childrenNodes };
                    });
                    return nodeInfos;
                } else {
                    console.log("Étape hors des limites.");
                    return null;
                }
            }

            // Fonction pour trouver le nœud parent
            function trouverParent(nodeId, edges) {
                const edge = edges.find(edge => edge.target === nodeId);
                return edge ? edge.source : null;
            }

            // Fonction pour récupérer les nœuds enfants
            function trouverEnfants(nodeId, edges) {
                const childrenNodesIds = edges.filter(edge => edge.source === nodeId).map(edge => edge.target);
                const childrenNodes = nodes.filter(node => childrenNodesIds.includes(node.id));
                return childrenNodes;
            }

            // Appel de la fonction pour trouver le parent et les enfants en fonction de step
            const nodesInfos = trouverParentEtEnfants(stepNumber, nodesByStep);
            const node = nodesInfos[0].node;
            const parent = nodesInfos[0].parent;
            const children = nodesInfos[0].enfants;

            return res.status(200).json({ node, parent, children });

        }).catch(error => {
            console.error('🚩Error when searching an IVR Menu with campaign ID🚩', error);
            return res.status(500).json({ error: '🚩Error when searching an IVR Menu with campaign ID🚩.' });
        });
    }
}

module.exports = ivr_menu;
