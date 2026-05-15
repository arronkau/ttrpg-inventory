import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
  runTransaction,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import { AddContainerModal } from "./AddContainerModal";
import { AddItemInputModal } from "./AddItemInputModal";
import { CharacterDetailsModal } from "./CharacterDetailsModal";
import { ContainerDetailsModal } from "./ContainerDetailsModal";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { GenericInputModal, Modal } from "./Modal";
import { ItemDetailsModal } from "./ItemDetailsModal";
import { AuditLogModal } from "./AuditLogModal";
import { TransferAllItemsModal } from "./TransferAllItemsModal";
import { ImportItemsModal } from "./ImportItemsModal";
import { HelpModal } from "./HelpModal";
import { PartyConfigModal } from "./PartyConfigModal";
import { calculateContainerWeight, formatWeight, formatWeightValue } from "../../utils/utils";
import {
  calculateCharacterEncumbrance,
  isProgrammaticEquippedContainer,
  isSingleItemEquippedContainer,
  normalizeCharacterForEquippedSections,
  normalizeContainersForEquippedSections,
  sanitizeDefaultContainers,
  splitEquippedAndStowedContainers,
} from "../../utils/encumbrance";
import { formatCoins } from "../../utils/coins";
import {
  PartyConfigContext,
  DEFAULT_PARTY_CONFIG,
} from "../../contexts/PartyConfigContext";

const generateId = () => crypto.randomUUID();
const ITEM_DRAG_MIME_TYPE = "application/x-ttrpg-inventory-item";

const clampIndex = (value, min, max) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return max;
  return Math.max(min, Math.min(n, max));
};

const getDropIndexFromPointer = (event, itemIndex) => {
  const rect = event.currentTarget.getBoundingClientRect();
  const isAfterMidpoint = event.clientY > rect.top + rect.height / 2;
  return itemIndex + (isAfterMidpoint ? 1 : 0);
};

const COUNTED_ITEM_NAME_REGEX = /^(.*?)\s*\((\d+)\)\s*$/;
const COIN_DENOMINATIONS = [
  ['platinum', 'p'],
  ['gold', 'g'],
  ['silver', 's'],
  ['copper', 'c'],
];

const parseCountedItemName = (name) => {
  const match = String(name || '').match(COUNTED_ITEM_NAME_REGEX);
  if (!match || !match[1].trim()) return null;

  const count = Number.parseInt(match[2], 10);
  if (!Number.isFinite(count)) return null;

  return {
    baseName: match[1].trim(),
    count,
  };
};

const formatCountedItemName = (baseName, count) => (
  `${String(baseName || '').trim()} (${Math.max(0, Math.trunc(Number(count) || 0))})`
);

const normalizeCoinsForAudit = (coins = {}) => COIN_DENOMINATIONS.reduce(
  (acc, [key]) => ({ ...acc, [key]: Number(coins?.[key] || 0) }),
  {},
);

const getCoinDelta = (oldCoins = {}, newCoins = {}) => {
  const before = normalizeCoinsForAudit(oldCoins);
  const after = normalizeCoinsForAudit(newCoins);
  return COIN_DENOMINATIONS.reduce(
    (acc, [key]) => ({ ...acc, [key]: after[key] - before[key] }),
    {},
  );
};

const formatCoinDelta = (delta = {}) => {
  const parts = COIN_DENOMINATIONS
    .map(([key, suffix]) => [Number(delta?.[key] || 0), suffix])
    .filter(([value]) => value !== 0)
    .map(([value, suffix]) => `${value > 0 ? '+' : ''}${value}${suffix}`);

  return parts.join(' ') || 'no change';
};

export default function InventoryAppContent({ firebaseConfig, appId, db: dbProp, auth: authProp }) {
  const { partyId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (partyId) {
      localStorage.setItem('lastVisitedParty', partyId);
    }
  }, [partyId]);

  const [db, setDb] = useState(dbProp || null);
  const [userId, setUserId] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState("");
  const [modalOnConfirm, setModalOnConfirm] = useState(null);

  const [showGenericInputModal, setShowGenericInputModal] = useState(false);
  const [genericInputModalConfig, setGenericInputModalConfig] = useState({
    title: "",
    placeholder: "",
    onSubmit: () => {},
  });

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemModalTarget, setAddItemModalTarget] = useState({
    characterId: "",
    containerId: "",
  });

  const [showDeleteCharacterConfirmModal, setShowDeleteCharacterConfirmModal] =
    useState(false);
  const [characterToDelete, setCharacterToDelete] = useState(null);

  const [showAddContainerModal, setShowAddContainerModal] = useState(false);
  const [addContainerModalTargetCharId, setAddContainerModalTargetCharId] =
    useState(null);

  const [showItemDetailsModal, setShowItemDetailsModal] = useState(false);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState(null);

  const [showContainerDetailsModal, setShowContainerDetailsModal] =
    useState(false);
  const [selectedContainerForDetails, setSelectedContainerForDetails] =
    useState(null);

  const [showCharacterDetailsModal, setShowCharacterDetailsModal] =
    useState(false);
  const [selectedCharacterForDetails, setSelectedCharacterForDetails] =
    useState(null);

  const [collapsedCharacters, setCollapsedCharacters] = useState({});
  const [collapsedContainers, setCollapsedContainers] = useState({});
  const [highestOrder, setHighestOrder] = useState(0);

  const [showAuditLogModal, setShowAuditLogModal] = useState(false);
  const [auditLog, setAuditLog] = useState([]);

  const [columnCount, setColumnCount] = useState(1);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1280) setColumnCount(4);
      else if (w >= 1024) setColumnCount(3);
      else if (w >= 768) setColumnCount(2);
      else setColumnCount(1);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const [showTransferAllModal, setShowTransferAllModal] = useState(false);
  const [transferAllSource, setTransferAllSource] = useState(null); // { charId, containerId, containerName }

  const [showImportItemsModal, setShowImportItemsModal] = useState(false);
  const [importTarget, setImportTarget] = useState(null); // { charId, containerId, containerName }

  const [showHelpModal, setShowHelpModal] = useState(false);

  const [partyConfig, setPartyConfig] = useState(DEFAULT_PARTY_CONFIG);
  const [showPartyConfigModal, setShowPartyConfigModal] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const formatPartyWeight = useCallback(
    (val) => formatWeight(val, partyConfig.weightUnit || DEFAULT_PARTY_CONFIG.weightUnit),
    [partyConfig.weightUnit],
  );

  const normalizeCharacterData = useCallback((data) => (
    normalizeCharacterForEquippedSections(data).character
  ), []);

  const getSingleItemContainerError = useCallback((container, incomingItemCount = 1, replacingItemId = null) => {
    if (!isSingleItemEquippedContainer(container)) return null;

    const existingItems = (container.items || []).filter((item) => item.id !== replacingItemId);
    if (existingItems.length + incomingItemCount > 1) {
      return `${container.name} can only hold one item.`;
    }

    return null;
  }, []);

  // Keyboard shortcut: 'e' to toggle expand/collapse all
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ignore if typing in an input, textarea, or select
      const tagName = event.target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        return;
      }

      // Ignore if any modal is open
      if (showModal || showGenericInputModal || showAddItemModal ||
          showDeleteCharacterConfirmModal || showAddContainerModal ||
          showItemDetailsModal || showContainerDetailsModal ||
          showCharacterDetailsModal || showAuditLogModal || showTransferAllModal ||
          showImportItemsModal || showHelpModal || showPartyConfigModal) {
        return;
      }

      if (event.key === 'e' || event.key === 'E') {
        event.preventDefault();

        // Check if any character or container is expanded
        // Note: default state (not in object) = collapsed, value false = expanded
        const anyCharExpanded = characters.some(char =>
          Object.prototype.hasOwnProperty.call(collapsedCharacters, char.id) &&
          !collapsedCharacters[char.id]
        );
        const anyContainerExpanded = characters.some(char =>
          (char.containers || []).some(container =>
            Object.prototype.hasOwnProperty.call(collapsedContainers, container.id) &&
            !collapsedContainers[container.id]
          )
        );

        if (anyCharExpanded || anyContainerExpanded) {
          // Collapse all
          const newCollapsedChars = {};
          const newCollapsedConts = {};
          characters.forEach(char => {
            newCollapsedChars[char.id] = true;
            (char.containers || []).forEach(container => {
              newCollapsedConts[container.id] = true;
            });
          });
          setCollapsedCharacters(newCollapsedChars);
          setCollapsedContainers(newCollapsedConts);
        } else {
          // Expand all
          const newCollapsedChars = {};
          const newCollapsedConts = {};
          characters.forEach(char => {
            newCollapsedChars[char.id] = false;
            (char.containers || []).forEach(container => {
              newCollapsedConts[container.id] = false;
            });
          });
          setCollapsedCharacters(newCollapsedChars);
          setCollapsedContainers(newCollapsedConts);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [characters, collapsedCharacters, collapsedContainers, showModal,
      showGenericInputModal, showAddItemModal, showDeleteCharacterConfirmModal,
      showAddContainerModal, showItemDetailsModal, showContainerDetailsModal,
      showCharacterDetailsModal, showAuditLogModal, showTransferAllModal,
      showImportItemsModal, showHelpModal, showPartyConfigModal]);

  useEffect(() => {
    // If db and auth are passed as props, use them directly
    if (dbProp && authProp) {
      setDb(dbProp);
      
      const unsubscribe = onAuthStateChanged(authProp, async (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          try {
            await signInAnonymously(authProp);
          } catch (error) {
            console.error("Firebase authentication error:", error);
            setModalContent(`Authentication Error: ${error.message}`);
            setShowModal(true);
          }
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } 
    // Otherwise initialize Firebase from config
    else if (firebaseConfig) {
      try {
        const app = initializeApp(firebaseConfig);
        const firestoreDb = getFirestore(app);
        const firebaseAuth = getAuth(app);

        setDb(firestoreDb);

        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            try {
              await signInAnonymously(firebaseAuth);
            } catch (error) {
              console.error("Firebase authentication error:", error);
              setModalContent(`Authentication Error: ${error.message}`);
              setShowModal(true);
            }
          }
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("Error initializing Firebase:", error);
        setModalContent(`Firebase Initialization Error: ${error.message}`);
        setShowModal(true);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [firebaseConfig, dbProp, authProp]);

  useEffect(() => {
    if (!partyId) {
      console.error(
        "CRITICAL ERROR: InventoryAppContent rendered without a partyId. This should be handled by AppWrapper.",
      );
      setModalContent(
        "Application error: No party ID found in URL. This component requires a party ID. Trying to redirect...",
      );
      setShowModal(true);
      setLoading(false);

      if (navigate) {
        const newPartyId = generateId();
        navigate(`/${newPartyId}`, { replace: true });
      }
      return;
    }

    if (db && userId && partyId) {
      const path = `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`;
      const charactersCollectionRef = collection(db, path);

      const unsubscribe = onSnapshot(
        charactersCollectionRef,
        (snapshot) => {
          const characterUpdates = [];
          const fetchedCharacters = snapshot.docs
            .map((docSnap, i) => {
              const data = docSnap.data();
              const { character, changed } = normalizeCharacterForEquippedSections({
                id: docSnap.id,
                ...data,
                order: data.order !== undefined ? data.order : i,
              });
              if (changed) {
                characterUpdates.push(
                  updateDoc(docSnap.ref, { containers: character.containers }),
                );
              }
              return character;
            })
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          if (characterUpdates.length > 0) {
            Promise.all(characterUpdates).catch((error) => {
              console.error("Error normalizing equipped containers:", error);
            });
          }
          setCharacters(fetchedCharacters);
          const maxOrder = fetchedCharacters.length > 0 
            ? Math.max(...fetchedCharacters.map(c => c.order || 0))
            : 0;
          setHighestOrder(maxOrder);
        },
        (error) => {
          console.error("Error fetching characters:", error);
          setModalContent(`Error fetching characters: ${error.message}`);
          setShowModal(true);
        },
      );

      return () => unsubscribe();
    }
  }, [db, userId, appId, partyId, navigate]);

  // Load audit log from Firestore (subcollection of entries, newest first)
  useEffect(() => {
    if (db && partyId) {
      const entriesRef = collection(
        db,
        `artifacts/${appId}/public/data/dnd_inventory/${partyId}/metadata/party-data/entries`,
      );
      const entriesQuery = query(entriesRef, orderBy('timestamp', 'desc'));

      const unsubscribe = onSnapshot(
        entriesQuery,
        (snapshot) => {
          setAuditLog(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        (error) => {
          console.error("Error fetching audit log:", error);
          setAuditLog([]);
        }
      );

      return () => unsubscribe();
    }
  }, [db, appId, partyId]);

  // Subscribe to per-party config (weight unit + default containers) on
  // metadata/party-data. Doc may not exist for new parties; defaults apply.
  useEffect(() => {
    if (db && partyId) {
      const configRef = doc(
        db,
        `artifacts/${appId}/public/data/dnd_inventory/${partyId}/metadata`,
        'party-data',
      );
      const unsubscribe = onSnapshot(
        configRef,
        (snap) => {
          const data = snap.exists() ? snap.data() : {};
          setPartyConfig({
            weightUnit: data.weightUnit || DEFAULT_PARTY_CONFIG.weightUnit,
            coinsPerWeightUnit: data.coinsPerWeightUnit || DEFAULT_PARTY_CONFIG.coinsPerWeightUnit,
            defaultContainers: sanitizeDefaultContainers(data.defaultContainers || DEFAULT_PARTY_CONFIG.defaultContainers),
          });
        },
        (error) => {
          console.error("Error fetching party config:", error);
          setPartyConfig(DEFAULT_PARTY_CONFIG);
        }
      );
      return () => unsubscribe();
    }
  }, [db, appId, partyId]);

  // Helper function to add audit log entry. Each entry is its own subcollection
  // doc so concurrent writers can't clobber each other.
  const addAuditLogEntry = useCallback(async (action, description) => {
    if (!db || !partyId) return;

    try {
      const entriesRef = collection(
        db,
        `artifacts/${appId}/public/data/dnd_inventory/${partyId}/metadata/party-data/entries`,
      );
      await addDoc(entriesRef, {
        action,
        description,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error adding audit log entry:", error);
    }
  }, [db, appId, partyId]);

  const commitBatchChunks = useCallback(async (operations, chunkSize = 400) => {
    for (let i = 0; i < operations.length; i += chunkSize) {
      const batch = writeBatch(db);
      operations.slice(i, i + chunkSize).forEach((operation) => operation(batch));
      await batch.commit();
    }
  }, [db]);

  const handleExportBackup = useCallback(() => {
    const backup = {
      backupVersion: 1,
      app: 'ttrpg-inventory',
      exportedAt: new Date().toISOString(),
      partyId,
      partyConfig,
      characters: characters.map((character) => ({
        ...character,
        containers: normalizeContainersForEquippedSections(character.containers || []).containers,
      })),
      auditLog: auditLog.map((entry) => ({ ...entry })),
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `ttrpg-inventory-backup-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [partyId, partyConfig, characters, auditLog]);

  const handleRestoreBackup = useCallback(async (backup) => {
    if (!db || !partyId) {
      throw new Error('Database not ready or no party selected.');
    }

    if (!backup || !Array.isArray(backup.characters) || !Array.isArray(backup.auditLog)) {
      throw new Error('Backup file must include characters and auditLog arrays.');
    }

    const charactersRef = collection(
      db,
      `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
    );
    const entriesRef = collection(
      db,
      `artifacts/${appId}/public/data/dnd_inventory/${partyId}/metadata/party-data/entries`,
    );
    const configRef = doc(
      db,
      `artifacts/${appId}/public/data/dnd_inventory/${partyId}/metadata`,
      'party-data',
    );

    const [existingCharactersSnap, existingEntriesSnap] = await Promise.all([
      getDocs(charactersRef),
      getDocs(entriesRef),
    ]);

    const operations = [];
    existingCharactersSnap.forEach((characterDoc) => {
      operations.push((batch) => batch.delete(characterDoc.ref));
    });
    existingEntriesSnap.forEach((entryDoc) => {
      operations.push((batch) => batch.delete(entryDoc.ref));
    });

    const importedConfig = backup.partyConfig || DEFAULT_PARTY_CONFIG;
    operations.push((batch) => batch.set(configRef, {
      weightUnit: importedConfig.weightUnit || DEFAULT_PARTY_CONFIG.weightUnit,
      coinsPerWeightUnit: importedConfig.coinsPerWeightUnit || DEFAULT_PARTY_CONFIG.coinsPerWeightUnit,
      defaultContainers: sanitizeDefaultContainers(
        importedConfig.defaultContainers || DEFAULT_PARTY_CONFIG.defaultContainers,
      ),
    }));

    backup.characters.forEach((rawCharacter, index) => {
      const { id, ...characterData } = rawCharacter || {};
      const characterId = id || generateId();
      const normalizedCharacter = normalizeCharacterForEquippedSections({
        ...characterData,
        order: characterData.order !== undefined ? characterData.order : index,
      }).character;
      const { id: _ignoredId, ...docData } = normalizedCharacter;
      operations.push((batch) => batch.set(doc(charactersRef, characterId), docData));
    });

    backup.auditLog.forEach((rawEntry) => {
      const { id, ...entryData } = rawEntry || {};
      const entryId = id || generateId();
      operations.push((batch) => batch.set(doc(entriesRef, entryId), {
        action: entryData.action || 'restored',
        description: entryData.description || '',
        timestamp: entryData.timestamp || new Date().toISOString(),
      }));
    });

    await commitBatchChunks(operations);
    setModalContent('Backup restored. Characters, containers, items, settings, and audit log have been replaced.');
    setShowModal(true);
  }, [db, appId, partyId, commitBatchChunks]);

  const handleSavePartyConfig = useCallback(async (config) => {
    if (!db || !partyId) return;
    try {
      const configRef = doc(
        db,
        `artifacts/${appId}/public/data/dnd_inventory/${partyId}/metadata`,
        'party-data',
      );
      await setDoc(configRef, {
        weightUnit: config.weightUnit,
        coinsPerWeightUnit: config.coinsPerWeightUnit,
        defaultContainers: sanitizeDefaultContainers(config.defaultContainers),
      }, { merge: true });
      await addAuditLogEntry('edited', 'party settings');
    } catch (error) {
      console.error("Error saving party config:", error);
      setModalContent(`Error saving settings: ${error.message}`);
      setShowModal(true);
    }
  }, [db, appId, partyId, addAuditLogEntry]);

  // Handler to transfer all items from one container to another
  const handleTransferAllItems = async (targetCharId, targetContainerId) => {
    if (!db || !partyId || !transferAllSource) return;

    const { charId: sourceCharId, containerId: sourceContainerId, containerName: sourceContainerName } = transferAllSource;

    try {
      if (sourceCharId === targetCharId) {
        const characterRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          sourceCharId
        );

        const result = await runTransaction(db, async (txn) => {
          const characterDoc = await txn.get(characterRef);
          if (!characterDoc.exists()) return null;

          const characterData = normalizeCharacterData(characterDoc.data());
          const sourceContainer = characterData.containers.find(c => c.id === sourceContainerId);
          const targetContainer = characterData.containers.find(c => c.id === targetContainerId);
          if (!sourceContainer || !targetContainer) return { error: "Error: Source or target container not found." };
          const itemsToTransfer = sourceContainer?.items || [];
          const singleItemError = getSingleItemContainerError(targetContainer, itemsToTransfer.length);
          if (singleItemError) return { error: singleItemError };

          const updatedContainers = characterData.containers.map(container => {
            if (container.id === sourceContainerId) {
              return { ...container, items: [] };
            } else if (container.id === targetContainerId) {
              return { ...container, items: [...(container.items || []), ...itemsToTransfer] };
            }
            return container;
          });

          txn.update(characterRef, { containers: updatedContainers });
          return {
            count: itemsToTransfer.length,
            characterName: characterData.name,
            targetContainerName: targetContainer?.name,
          };
        });

        if (result?.error) {
          setModalContent(result.error);
          setShowModal(true);
        }
      } else {
        const sourceCharRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          sourceCharId
        );
        const targetCharRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          targetCharId
        );

        const result = await runTransaction(db, async (txn) => {
          const [sourceCharDoc, targetCharDoc] = await Promise.all([
            txn.get(sourceCharRef),
            txn.get(targetCharRef),
          ]);
          if (!sourceCharDoc.exists() || !targetCharDoc.exists()) return null;

          const sourceCharData = normalizeCharacterData(sourceCharDoc.data());
          const targetCharData = normalizeCharacterData(targetCharDoc.data());
          const sourceContainer = sourceCharData.containers.find(c => c.id === sourceContainerId);
          const targetContainer = targetCharData.containers.find(c => c.id === targetContainerId);
          if (!sourceContainer || !targetContainer) return { error: "Error: Source or target container not found." };
          const itemsToTransfer = sourceContainer?.items || [];
          const singleItemError = getSingleItemContainerError(targetContainer, itemsToTransfer.length);
          if (singleItemError) return { error: singleItemError };

          const updatedSourceContainers = sourceCharData.containers.map(container => {
            if (container.id === sourceContainerId) {
              return { ...container, items: [] };
            }
            return container;
          });

          const updatedTargetContainers = targetCharData.containers.map(container => {
            if (container.id === targetContainerId) {
              return { ...container, items: [...(container.items || []), ...itemsToTransfer] };
            }
            return container;
          });

          txn.update(sourceCharRef, { containers: updatedSourceContainers });
          txn.update(targetCharRef, { containers: updatedTargetContainers });

          return {
            count: itemsToTransfer.length,
            sourceCharName: sourceCharData.name,
            targetCharName: targetCharData.name,
            targetContainerName: targetContainer?.name,
          };
        });

        if (result?.error) {
          setModalContent(result.error);
          setShowModal(true);
        } else if (result) {
          await addAuditLogEntry(
            'moved',
            `transferred ${result.count} item(s) from ${result.sourceCharName}'s ${sourceContainerName} to ${result.targetCharName}'s ${result.targetContainerName}`
          );
        }
      }
    } catch (error) {
      console.error("Error transferring items:", error);
      setModalContent(`Error transferring items: ${error.message}`);
      setShowModal(true);
    }
  };

  const handleSendCharacterToBottom = async (charId) => {
    const characterRef = doc(
      db,
      `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
      charId,
    );

    await updateDoc(characterRef, { order: highestOrder + 1 });
  };

  const handleAddCharacterClick = () => {
    if (!db || !userId || !partyId) {
      setModalContent(
        "Database not ready, user not authenticated, or no party selected.",
      );
      setShowModal(true);
      return;
    }
    setGenericInputModalConfig({
      title: "Enter Character Name",
      placeholder: "Character Name",
      onSubmit: async (characterName) => {
        if (characterName) {
          try {
            const stowedDefaults = sanitizeDefaultContainers(
              (partyConfig.defaultContainers && partyConfig.defaultContainers.length > 0)
                ? partyConfig.defaultContainers
                : DEFAULT_PARTY_CONFIG.defaultContainers,
            );
            const stowedContainers = stowedDefaults.map((c) => ({
              id: generateId(),
              name: c.name,
              items: [],
              weight: c.weight || 0,
              maxCapacity: c.maxCapacity || 0,
            }));
            const { containers } = normalizeContainersForEquippedSections(stowedContainers);
            const newCharacter = {
              name: characterName,
              strengthModifier: 0,
              containers,
            };
            await addDoc(
              collection(
                db,
                `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
              ),
              newCharacter,
            );
            // Log the character creation
            await addAuditLogEntry(
              'created',
              `character "${characterName}"`
            );
          } catch (error) {
            console.error("Error adding character:", error);
            setModalContent(`Error adding character: ${error.message}`);
            setShowModal(true);
          }
        }
      },
    });
    setShowGenericInputModal(true);
  };

  const handleAddItemClick = (characterId, containerId) => {
    if (!db || !userId || !partyId) {
      setModalContent(
        "Database not ready, user not authenticated, or no party selected.",
      );
      setShowModal(true);
      return;
    }
    setAddItemModalTarget({ characterId, containerId });
    setShowAddItemModal(true);
  };

  const handleCollapseCharacter = (charId) =>
    setCollapsedCharacters({ ...collapsedCharacters, [charId]: true });

  const handleExpandCharacter = (charId) =>
    setCollapsedCharacters({ ...collapsedCharacters, [charId]: false });

  const handleCollapseContainer = (containerId) =>
    setCollapsedContainers({ ...collapsedContainers, [containerId]: true });

  const handleExpandContainer = (containerId) =>
    setCollapsedContainers({ ...collapsedContainers, [containerId]: false });

  const handleAddItemSubmit = async (itemName, itemWeight, itemDescription = "", extraData = null) => {
    if (!db || !userId || !partyId) {
      setModalContent(
        "Database not ready, user not authenticated, or no party selected.",
      );
      setShowModal(true);
      return;
    }

    const { characterId, containerId } = addItemModalTarget;

    if (itemName && !isNaN(itemWeight) && itemWeight >= 0) {
      try {
        const characterRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          characterId,
        );

        const result = await runTransaction(db, async (txn) => {
          const characterDoc = await txn.get(characterRef);
          if (!characterDoc.exists()) return null;

          const characterData = normalizeCharacterData(characterDoc.data());
          const container = characterData.containers.find(c => c.id === containerId);
          if (!container) return { error: "Error: Container not found." };
          const existingCoinsIndex = (container.items || []).findIndex(item => item.itemType === 'coins');
          const canMergeIntoExistingCoins = extraData?.itemType === 'coins' && existingCoinsIndex !== -1;
          const singleItemError = canMergeIntoExistingCoins
            ? null
            : getSingleItemContainerError(container, 1);
          if (singleItemError) return { error: singleItemError };

          // Build the new item object
          const newItem = {
            id: generateId(),
            name: itemName,
            weight: itemWeight,
            description: itemDescription,
          };

          // Add unidentified fields if provided
          if (extraData?.isUnidentified) {
            newItem.isUnidentified = true;
            newItem.secretName = extraData.secretName || '';
            newItem.secretDescription = extraData.secretDescription || '';
          }

          // Add coins fields if provided
          if (extraData?.itemType === 'coins') {
            newItem.itemType = 'coins';
            newItem.coins = extraData.coins;
          }

          // Add treasure fields if provided
          if (extraData?.itemType === 'treasure') {
            newItem.itemType = 'treasure';
            newItem.goldValue = extraData.goldValue;
            newItem.quantity = extraData.quantity;
            newItem.weightPerItem = extraData.weightPerItem;
          }

          // If adding coins, check if there's already a coins item in the container and merge
          if (extraData?.itemType === 'coins' && container) {
            if (existingCoinsIndex !== -1) {
              const updatedContainers = characterData.containers.map((cont) => {
                if (cont.id === containerId) {
                  const updatedItems = [...(cont.items || [])];
                  const existingCoins = updatedItems[existingCoinsIndex];
                  const mergedCoins = {
                    platinum: (existingCoins.coins?.platinum || 0) + (extraData.coins?.platinum || 0),
                    gold: (existingCoins.coins?.gold || 0) + (extraData.coins?.gold || 0),
                    silver: (existingCoins.coins?.silver || 0) + (extraData.coins?.silver || 0),
                    copper: (existingCoins.coins?.copper || 0) + (extraData.coins?.copper || 0),
                  };
                  const totalCoins = mergedCoins.platinum + mergedCoins.gold + mergedCoins.silver + mergedCoins.copper;
                  const coinWeight = Math.ceil(totalCoins / partyConfig.coinsPerWeightUnit);
                  const parts = [];
                  if (mergedCoins.platinum > 0) parts.push(`${mergedCoins.platinum}p`);
                  if (mergedCoins.gold > 0) parts.push(`${mergedCoins.gold}g`);
                  if (mergedCoins.silver > 0) parts.push(`${mergedCoins.silver}s`);
                  if (mergedCoins.copper > 0) parts.push(`${mergedCoins.copper}c`);
                  const coinName = `$ ${parts.join(' ') || '0c'}`;

                  updatedItems[existingCoinsIndex] = {
                    ...existingCoins,
                    name: coinName,
                    weight: coinWeight,
                    coins: mergedCoins,
                  };
                  return { ...cont, items: updatedItems };
                }
                return cont;
              });
              txn.update(characterRef, { containers: updatedContainers });
              return { merged: true, addedCoins: extraData.coins, characterName: characterData.name, containerName: container?.name };
            }
          }

          // Default: add as new item
          const updatedContainers = characterData.containers.map((cont) => {
            if (cont.id === containerId) {
              return {
                ...cont,
                items: [...(cont.items || []), newItem],
              };
            }
            return cont;
          });
          txn.update(characterRef, { containers: updatedContainers });
          return { merged: false, characterName: characterData.name, containerName: container?.name };
        });

        if (result?.error) {
          setModalContent(result.error);
          setShowModal(true);
        } else if (result?.merged) {
          await addAuditLogEntry(
            'edited',
            `coins in ${result.characterName}'s ${result.containerName || 'container'}: ${formatCoinDelta(result.addedCoins)}`
          );
        } else if (result) {
          const itemTypeLabel = extraData?.itemType === 'coins' ? ' (coins)' :
                               extraData?.itemType === 'treasure' ? ' (treasure)' :
                               extraData?.isUnidentified ? ' (unidentified)' : '';
          await addAuditLogEntry(
            'created',
            `item "${itemName}"${itemTypeLabel} in ${result.characterName}'s ${result.containerName || 'container'}`
          );
        }
      } catch (error) {
        console.error("Error adding item:", error);
        setModalContent(`Error adding item: ${error.message}`);
        setShowModal(true);
      }
    } else {
      setModalContent(
        `Invalid item name or slots. Please enter a valid name and a non-negative number of ${partyConfig.weightUnit.plural} (e.g., '1' or '2').`,
      );
      setShowModal(true);
    }
  };

  const handleDeleteCharacterConfirmation = (characterId, characterName) => {
    if (!db || !userId || !partyId) {
      setModalContent(
        "Database not ready, user not authenticated, or no party selected.",
      );
      setShowModal(true);
      return;
    }
    setCharacterToDelete({ id: characterId, name: characterName });
    setShowDeleteCharacterConfirmModal(true);
  };

  const deleteCharacter = async () => {
    if (!db || !userId || !partyId || !characterToDelete) {
      setModalContent("Error: Cannot delete character. Data missing.");
      setShowModal(true);
      return;
    }

    try {
      const characterName = characterToDelete.name;
      await deleteDoc(
        doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          characterToDelete.id,
        ),
      );

      // Log the character deletion
      await addAuditLogEntry(
        'deleted',
        `character "${characterName}"`
      );

      setShowDeleteCharacterConfirmModal(false);
      setCharacterToDelete(null);
    } catch (error) {
      console.error("Error deleting character:", error);
      setModalContent(`Error deleting character: ${error.message}`);
      setShowModal(true);
    }
  };

  const handleAddContainerClick = (characterId) => {
    if (!db || !userId || !partyId) {
      setModalContent(
        "Database not ready, user not authenticated, or no party selected.",
      );
      setShowModal(true);
      return;
    }
    setAddContainerModalTargetCharId(characterId);
    setShowAddContainerModal(true);
  };

  const handleAddContainerSubmit = async (
    containerName,
    containerWeight,
    maxCapacity,
  ) => {
    if (!db || !userId || !partyId || !addContainerModalTargetCharId) {
      setModalContent("Error: Cannot add container. Data missing.");
      setShowModal(true);
      return;
    }

    if (
      containerName &&
      !isNaN(containerWeight) &&
      !isNaN(maxCapacity) &&
      maxCapacity >= 0
    ) {
      try {
        const characterRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          addContainerModalTargetCharId,
        );

        const characterName = await runTransaction(db, async (txn) => {
          const characterDoc = await txn.get(characterRef);
          if (!characterDoc.exists()) return null;

          const characterData = normalizeCharacterData(characterDoc.data());
          const newContainer = {
            id: generateId(),
            name: containerName,
            type: "custom",
            weight: containerWeight,
            maxCapacity: maxCapacity,
            items: [],
            description: "",
          };
          const updatedContainers = [...characterData.containers, newContainer];
          txn.update(characterRef, { containers: updatedContainers });
          return characterData.name;
        });

        if (characterName) {
          await addAuditLogEntry(
            'created',
            `container "${containerName}" for ${characterName}`
          );
        }
      } catch (error) {
        console.error("Error adding container:", error);
        setModalContent(`Error adding container: ${error.message}`);
        setShowModal(true);
      }
    } else {
      setModalContent(
        `Invalid container data. Please enter a valid name, container slots (usually 0), and a non-negative capacity in ${partyConfig.weightUnit.plural} (e.g., '10' or '5.5').`,
      );
      setShowModal(true);
    }
  };

  const handleSaveCharacterDetails = useCallback(
    async (charId, newName, newStrengthModifier = 0) => {
      if (!db || !userId || !partyId) {
        setModalContent(
          "Error: Cannot save character details. Database not ready or user not authenticated.",
        );
        setShowModal(true);
        return;
      }

      try {
        const characterRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          charId,
        );
        const characterDoc = await getDoc(characterRef);

        if (characterDoc.exists()) {
          await updateDoc(characterRef, { name: newName, strengthModifier: newStrengthModifier });
        }
      } catch (error) {
        console.error("Error saving character details:", error);
        setModalContent(`Error saving character details: ${error.message}`);
        setShowModal(true);
      } finally {
        setShowCharacterDetailsModal(false);
        setSelectedCharacterForDetails(null);
      }
    },
    [db, userId, appId, partyId],
  );

  const updateItemDescription = useCallback(
    async (itemId, newName, newWeight, newDescription) => {
      if (!db || !userId || !partyId || !selectedItemForDetails) {
        setModalContent("Error: Cannot update item description. Data missing.");
        setShowModal(true);
        return;
      }

      const { charId, containerId } = selectedItemForDetails;
      try {
        const characterRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          charId,
        );

        const result = await runTransaction(db, async (txn) => {
          const characterDoc = await txn.get(characterRef);
          if (!characterDoc.exists()) return null;

          const characterData = normalizeCharacterData(characterDoc.data());
          const container = characterData.containers.find(c => c.id === containerId);
          const oldItem = container?.items?.find(i => i.id === itemId);
          const updatedContainers = characterData.containers.map((cont) => {
            if (cont.id === containerId) {
              const updatedItems = (cont.items || []).map((item) => {
                if (item.id === itemId) {
                  return {
                    ...item,
                    name: newName,
                    weight: newWeight,
                    description: newDescription,
                  };
                }
                return item;
              });
              return { ...cont, items: updatedItems };
            }
            return cont;
          });
          txn.update(characterRef, { containers: updatedContainers });
          return { oldItem, characterName: characterData.name, containerName: container?.name };
        });

        if (result?.oldItem) {
          const { oldItem, characterName, containerName } = result;
          const changed =
            oldItem.name !== newName ||
            oldItem.weight !== newWeight ||
            oldItem.description !== newDescription;
          if (changed) {
            await addAuditLogEntry(
              'edited',
              `item "${oldItem.name}"${oldItem.name !== newName ? ` (renamed to "${newName}")` : ''} in ${characterName}'s ${containerName || 'container'}`
            );
          }
        }
      } catch (error) {
        console.error("Error updating item description:", error);
        setModalContent(`Error updating description: ${error.message}`);
        setShowModal(true);
      } finally {
        setSelectedItemForDetails(null);
        setShowItemDetailsModal(false);
      }
    },
    [db, userId, appId, partyId, selectedItemForDetails, addAuditLogEntry, partyConfig.coinsPerWeightUnit],
  );

  // Handler to save an item with full updates (including type changes)
  const handleSaveItem = useCallback(
    async (itemId, updatedFields) => {
      if (!db || !userId || !partyId || !selectedItemForDetails) {
        setModalContent("Error: Cannot update item. Data missing.");
        setShowModal(true);
        return;
      }

      const { charId, containerId } = selectedItemForDetails;
      try {
        const characterRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          charId,
        );

        const result = await runTransaction(db, async (txn) => {
          const characterDoc = await txn.get(characterRef);
          if (!characterDoc.exists()) return null;

          const characterData = normalizeCharacterData(characterDoc.data());
          const container = characterData.containers.find(c => c.id === containerId);
          const oldItem = container?.items?.find(i => i.id === itemId);

          // Special handling: if converting to coins, check for existing coins to merge
          if (updatedFields.itemType === 'coins') {
            const existingCoins = (container?.items || []).find(
              item => item.itemType === 'coins' && item.id !== itemId
            );

            if (existingCoins) {
              const mergedCoins = {
                platinum: (existingCoins.coins?.platinum || 0) + (updatedFields.coins?.platinum || 0),
                gold: (existingCoins.coins?.gold || 0) + (updatedFields.coins?.gold || 0),
                silver: (existingCoins.coins?.silver || 0) + (updatedFields.coins?.silver || 0),
                copper: (existingCoins.coins?.copper || 0) + (updatedFields.coins?.copper || 0),
              };
              const totalCoins = mergedCoins.platinum + mergedCoins.gold + mergedCoins.silver + mergedCoins.copper;
              const coinWeight = Math.ceil(totalCoins / partyConfig.coinsPerWeightUnit);
              const parts = [];
              if (mergedCoins.platinum > 0) parts.push(`${mergedCoins.platinum}p`);
              if (mergedCoins.gold > 0) parts.push(`${mergedCoins.gold}g`);
              if (mergedCoins.silver > 0) parts.push(`${mergedCoins.silver}s`);
              if (mergedCoins.copper > 0) parts.push(`${mergedCoins.copper}c`);
              const coinName = `$ ${parts.join(' ') || '0c'}`;

              const updatedContainers = characterData.containers.map((cont) => {
                if (cont.id === containerId) {
                  const updatedItems = (cont.items || [])
                    .filter(item => item.id !== itemId)
                    .map(item => {
                      if (item.id === existingCoins.id) {
                        return {
                          ...item,
                          name: coinName,
                          weight: coinWeight,
                          coins: mergedCoins,
                        };
                      }
                      return item;
                    });
                  return { ...cont, items: updatedItems };
                }
                return cont;
              });

              txn.update(characterRef, { containers: updatedContainers });
              return { mergedToExisting: true, oldItem, addedCoins: updatedFields.coins, characterName: characterData.name, containerName: container?.name };
            }
          }

          const updatedContainers = characterData.containers.map((cont) => {
            if (cont.id === containerId) {
              const updatedItems = (cont.items || []).map((item) => {
                if (item.id === itemId) {
                  // Build new item, removing old type-specific fields
                  const newItem = {
                    id: item.id,
                    name: updatedFields.name,
                    weight: updatedFields.weight,
                    description: updatedFields.description || '',
                  };

                  if (updatedFields.itemType === 'coins') {
                    newItem.itemType = 'coins';
                    newItem.coins = updatedFields.coins;
                  } else if (updatedFields.itemType === 'treasure') {
                    newItem.itemType = 'treasure';
                    newItem.goldValue = updatedFields.goldValue;
                    if (updatedFields.quantity) newItem.quantity = updatedFields.quantity;
                    if (updatedFields.weightPerItem !== undefined) newItem.weightPerItem = updatedFields.weightPerItem;
                  }

                  return newItem;
                }
                return item;
              });
              return { ...cont, items: updatedItems };
            }
            return cont;
          });

          txn.update(characterRef, { containers: updatedContainers });
          return { mergedToExisting: false, oldItem, characterName: characterData.name, containerName: container?.name };
        });

        if (result?.mergedToExisting && result.oldItem) {
          await addAuditLogEntry(
            'edited',
            `converted "${result.oldItem.name}" to coins in ${result.characterName}'s ${result.containerName || 'container'}: ${formatCoinDelta(result.addedCoins)}`
          );
        } else if (result?.oldItem) {
          const { oldItem, characterName, containerName } = result;
          const typeChanged = (oldItem.itemType || 'normal') !== (updatedFields.itemType || 'normal');
          const typeLabel = typeChanged ? ` (type changed to ${updatedFields.itemType || 'normal'})` : '';
          await addAuditLogEntry(
            'edited',
            `item "${oldItem.name}"${oldItem.name !== updatedFields.name ? ` (renamed to "${updatedFields.name}")` : ''}${typeLabel} in ${characterName}'s ${containerName || 'container'}`
          );
        }
      } catch (error) {
        console.error("Error updating item:", error);
        setModalContent(`Error updating item: ${error.message}`);
        setShowModal(true);
      } finally {
        setSelectedItemForDetails(null);
        setShowItemDetailsModal(false);
      }
    },
    [db, userId, appId, partyId, selectedItemForDetails, addAuditLogEntry, partyConfig.coinsPerWeightUnit],
  );

  const handleSaveContainerDetails = useCallback(
    async (
      charId,
      containerId,
      newName,
      newWeight,
      newMaxCapacityPounds,
      newDescription,
    ) => {
      if (!db || !userId || !partyId) {
        setModalContent(
          "Error: Cannot save container details. Database not ready or user not authenticated.",
        );
        setShowModal(true);
        return;
      }

      try {
        const characterRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          charId,
        );

        await runTransaction(db, async (txn) => {
          const characterDoc = await txn.get(characterRef);
          if (!characterDoc.exists()) return;

          const characterData = normalizeCharacterData(characterDoc.data());
          const updatedContainers = characterData.containers.map((container) => {
            if (container.id === containerId) {
              return {
                ...container,
                name: newName,
                weight: newWeight,
                maxCapacity: newMaxCapacityPounds,
                description: newDescription,
              };
            }
            return container;
          });
          txn.update(characterRef, { containers: updatedContainers });
        });
      } catch (error) {
        console.error("Error saving container details:", error);
        setModalContent(`Error saving container details: ${error.message}`);
        setShowModal(true);
      } finally {
        setShowContainerDetailsModal(false);
        setSelectedContainerForDetails(null);
      }
    },
    [db, userId, appId, partyId],
  );

  const handleDeleteContainer = useCallback(
    async (charId, containerId, containerName) => {
      if (!db || !userId || !partyId) {
        setModalContent(
          "Database not ready, user not authenticated, or no party selected.",
        );
        setShowModal(true);
        return;
      }

      setModalContent(
        `Are you sure you want to delete the container "${containerName}"? This action cannot be undone.`,
      );
      setModalOnConfirm(() => async () => {
        setShowModal(false);
        setModalOnConfirm(null);

        try {
          const characterRef = doc(
            db,
            `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
            charId,
          );

          const characterName = await runTransaction(db, async (txn) => {
            const characterDoc = await txn.get(characterRef);
            if (!characterDoc.exists()) return null;

            const characterData = normalizeCharacterData(characterDoc.data());
            const updatedContainers = characterData.containers.filter(
              (container) => container.id !== containerId,
            );
            txn.update(characterRef, { containers: updatedContainers });
            return characterData.name;
          });

          if (characterName) {
            await addAuditLogEntry(
              'deleted',
              `container "${containerName}" from ${characterName}`
            );
          }
        } catch (error) {
          console.error("Error deleting container:", error);
          setModalContent(`Error deleting container: ${error.message}`);
          setShowModal(true);
        } finally {
          setShowContainerDetailsModal(false);
          setSelectedContainerForDetails(null);
        }
      });
      setShowModal(true);
    },
    [db, userId, appId, partyId, addAuditLogEntry, partyConfig.coinsPerWeightUnit],
  );

  const handleDeleteItem = useCallback(
    async (charId, containerId, itemId) => {
      if (!db || !userId || !partyId) {
        setModalContent(
          "Database not ready, user not authenticated, or no party selected.",
        );
        setShowModal(true);
        return;
      }

      setModalContent("Are you sure you want to delete this item?");
      setModalOnConfirm(() => async () => {
        setShowModal(false);
        setModalOnConfirm(null);

        try {
          const characterRef = doc(
            db,
            `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
            charId,
          );

          const result = await runTransaction(db, async (txn) => {
            const characterDoc = await txn.get(characterRef);
            if (!characterDoc.exists()) return null;

            const characterData = normalizeCharacterData(characterDoc.data());
            const container = characterData.containers.find(c => c.id === containerId);
            const item = container?.items?.find(i => i.id === itemId);
            const updatedContainers = characterData.containers.map((cont) => {
              if (cont.id === containerId) {
                return {
                  ...cont,
                  items: (cont.items || []).filter((i) => i.id !== itemId),
                };
              }
              return cont;
            });
            txn.update(characterRef, { containers: updatedContainers });
            return { item, characterName: characterData.name, containerName: container?.name };
          });

          if (result?.item) {
            await addAuditLogEntry(
              'deleted',
              `item "${result.item.name}" from ${result.characterName}'s ${result.containerName || 'container'}`
            );
          }
        } catch (error) {
          console.error("Error deleting item:", error);
          setModalContent(`Error deleting item: ${error.message}`);
          setShowModal(true);
        } finally {
          setShowItemDetailsModal(false);
          setSelectedItemForDetails(null);
        }
      });
      setShowModal(true);
    },
    [db, userId, appId, partyId, addAuditLogEntry, partyConfig.coinsPerWeightUnit],
  );

  // Handler to transfer a single item to a different character/container
  // partialData: optional { type: 'coins', coins: {...} } or { type: 'treasure', quantity: N }
  const handleTransferItem = useCallback(
    async (itemId, sourceCharId, sourceContainerId, targetCharId, targetContainerId, partialData = null) => {
      if (!db || !userId || !partyId) {
        setModalContent(
          "Database not ready, user not authenticated, or no party selected.",
        );
        setShowModal(true);
        return;
      }

      // Don't allow transfer to same container
      if (sourceCharId === targetCharId && sourceContainerId === targetContainerId) {
        return;
      }

      try {
        const sourceCharRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          sourceCharId,
        );
        const targetCharRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          targetCharId,
        );
        const sameChar = sourceCharId === targetCharId;

        const buildCoinItem = (coins, id) => {
          const total = (coins.platinum || 0) + (coins.gold || 0) + (coins.silver || 0) + (coins.copper || 0);
          const weight = Math.ceil(total / partyConfig.coinsPerWeightUnit);
          const parts = [];
          if (coins.platinum > 0) parts.push(`${coins.platinum}p`);
          if (coins.gold > 0) parts.push(`${coins.gold}g`);
          if (coins.silver > 0) parts.push(`${coins.silver}s`);
          if (coins.copper > 0) parts.push(`${coins.copper}c`);
          return {
            id,
            name: `$ ${parts.join(' ') || '0c'}`,
            weight,
            description: '',
            itemType: 'coins',
            coins: { ...coins },
          };
        };

        const mergeCoinsIntoContainer = (containerItems, coinItem) => {
          const existingCoinsIndex = containerItems.findIndex(item => item.itemType === 'coins');
          if (existingCoinsIndex !== -1) {
            const existingCoins = containerItems[existingCoinsIndex];
            const mergedCoins = {
              platinum: (existingCoins.coins?.platinum || 0) + (coinItem.coins?.platinum || 0),
              gold: (existingCoins.coins?.gold || 0) + (coinItem.coins?.gold || 0),
              silver: (existingCoins.coins?.silver || 0) + (coinItem.coins?.silver || 0),
              copper: (existingCoins.coins?.copper || 0) + (coinItem.coins?.copper || 0),
            };
            const updatedItems = [...containerItems];
            updatedItems[existingCoinsIndex] = buildCoinItem(mergedCoins, existingCoins.id);
            return updatedItems;
          }
          return [...containerItems, coinItem];
        };

        const buildTreasureName = (baseName, qty, goldValue) =>
          qty > 1 ? `${qty}x ${baseName} (${goldValue}g)` : `${baseName} (${goldValue}g)`;

        const result = await runTransaction(db, async (txn) => {
          const sourceCharDoc = await txn.get(sourceCharRef);
          const targetCharDoc = sameChar ? sourceCharDoc : await txn.get(targetCharRef);

          if (!sourceCharDoc.exists() || !targetCharDoc.exists()) {
            return { error: "Error: Source or target character not found." };
          }

          const sourceCharData = normalizeCharacterData(sourceCharDoc.data());
          const targetCharData = sameChar ? sourceCharData : normalizeCharacterData(targetCharDoc.data());

          const sourceContainer = sourceCharData.containers.find(c => c.id === sourceContainerId);
          const targetContainer = targetCharData.containers.find(c => c.id === targetContainerId);
          if (!sourceContainer || !targetContainer) {
            return { error: "Error: Source or target container not found." };
          }

          const itemToMove = (sourceContainer.items || []).find(i => i.id === itemId);
          if (!itemToMove) {
            return { error: "Error: Item not found." };
          }

          const targetHasMatchingCoinItem =
            itemToMove.itemType === 'coins' &&
            (targetContainer.items || []).some((item) => item.itemType === 'coins');
          const singleItemError = getSingleItemContainerError(
            targetContainer,
            targetHasMatchingCoinItem ? 0 : 1,
          );
          if (singleItemError) return { error: singleItemError };

          // Partial coin transfer
          if (partialData?.type === 'coins' && itemToMove.itemType === 'coins') {
            const coinsToTransfer = partialData.coins;
            const totalToTransfer = (coinsToTransfer.platinum || 0) + (coinsToTransfer.gold || 0) +
                                    (coinsToTransfer.silver || 0) + (coinsToTransfer.copper || 0);
            if (totalToTransfer === 0) return { skip: true };

            const remainingCoins = {
              platinum: (itemToMove.coins?.platinum || 0) - (coinsToTransfer.platinum || 0),
              gold: (itemToMove.coins?.gold || 0) - (coinsToTransfer.gold || 0),
              silver: (itemToMove.coins?.silver || 0) - (coinsToTransfer.silver || 0),
              copper: (itemToMove.coins?.copper || 0) - (coinsToTransfer.copper || 0),
            };
            const totalRemaining = remainingCoins.platinum + remainingCoins.gold + remainingCoins.silver + remainingCoins.copper;

            if (sameChar) {
              const updatedContainers = sourceCharData.containers.map((container) => {
                let newItems = [...(container.items || [])];

                if (container.id === sourceContainerId) {
                  if (totalRemaining <= 0) {
                    newItems = newItems.filter((item) => item.id !== itemId);
                  } else {
                    newItems = newItems.map((item) =>
                      item.id === itemId ? buildCoinItem(remainingCoins, item.id) : item
                    );
                  }
                }

                if (container.id === targetContainerId) {
                  const existingCoinsIndex = newItems.findIndex(item => item.itemType === 'coins');
                  if (existingCoinsIndex !== -1) {
                    const existingCoins = newItems[existingCoinsIndex];
                    const mergedCoins = {
                      platinum: (existingCoins.coins?.platinum || 0) + (coinsToTransfer.platinum || 0),
                      gold: (existingCoins.coins?.gold || 0) + (coinsToTransfer.gold || 0),
                      silver: (existingCoins.coins?.silver || 0) + (coinsToTransfer.silver || 0),
                      copper: (existingCoins.coins?.copper || 0) + (coinsToTransfer.copper || 0),
                    };
                    newItems[existingCoinsIndex] = buildCoinItem(mergedCoins, existingCoins.id);
                  } else {
                    newItems.push(buildCoinItem(coinsToTransfer, generateId()));
                  }
                }

                return { ...container, items: newItems };
              });
              txn.update(sourceCharRef, { containers: updatedContainers });
            } else {
              const newSourceContainers = sourceCharData.containers.map((container) => {
                if (container.id === sourceContainerId) {
                  let newItems = [...(container.items || [])];
                  if (totalRemaining <= 0) {
                    newItems = newItems.filter((item) => item.id !== itemId);
                  } else {
                    newItems = newItems.map((item) =>
                      item.id === itemId ? buildCoinItem(remainingCoins, item.id) : item
                    );
                  }
                  return { ...container, items: newItems };
                }
                return container;
              });

              const newTargetContainers = targetCharData.containers.map((container) => {
                if (container.id === targetContainerId) {
                  let newItems = [...(container.items || [])];
                  const existingCoinsIndex = newItems.findIndex(item => item.itemType === 'coins');
                  if (existingCoinsIndex !== -1) {
                    const existingCoins = newItems[existingCoinsIndex];
                    const mergedCoins = {
                      platinum: (existingCoins.coins?.platinum || 0) + (coinsToTransfer.platinum || 0),
                      gold: (existingCoins.coins?.gold || 0) + (coinsToTransfer.gold || 0),
                      silver: (existingCoins.coins?.silver || 0) + (coinsToTransfer.silver || 0),
                      copper: (existingCoins.coins?.copper || 0) + (coinsToTransfer.copper || 0),
                    };
                    newItems[existingCoinsIndex] = buildCoinItem(mergedCoins, existingCoins.id);
                  } else {
                    newItems.push(buildCoinItem(coinsToTransfer, generateId()));
                  }
                  return { ...container, items: newItems };
                }
                return container;
              });

              txn.update(sourceCharRef, { containers: newSourceContainers });
              txn.update(targetCharRef, { containers: newTargetContainers });
            }

            const coinParts = [];
            if (coinsToTransfer.platinum > 0) coinParts.push(`${coinsToTransfer.platinum}p`);
            if (coinsToTransfer.gold > 0) coinParts.push(`${coinsToTransfer.gold}g`);
            if (coinsToTransfer.silver > 0) coinParts.push(`${coinsToTransfer.silver}s`);
            if (coinsToTransfer.copper > 0) coinParts.push(`${coinsToTransfer.copper}c`);

            return {
              auditDescription: sameChar
                ? null
                : `${coinParts.join(' ')} from ${sourceCharData.name}'s ${sourceContainer.name} to ${targetCharData.name}'s ${targetContainer.name}`,
            };
          }

          // Partial treasure transfer
          if (partialData?.type === 'treasure' && itemToMove.itemType === 'treasure') {
            const qtyToTransfer = Math.min(partialData.quantity, itemToMove.quantity || 1);
            const remainingQty = (itemToMove.quantity || 1) - qtyToTransfer;
            const baseName = itemToMove.name.replace(/^\d+x\s*/, '').replace(/\s*\(\d+g\)\s*$/, '').trim();

            if (sameChar) {
              const updatedContainers = sourceCharData.containers.map((container) => {
                let newItems = [...(container.items || [])];

                if (container.id === sourceContainerId) {
                  if (remainingQty <= 0) {
                    newItems = newItems.filter((item) => item.id !== itemId);
                  } else {
                    newItems = newItems.map((item) => {
                      if (item.id === itemId) {
                        return {
                          ...item,
                          name: buildTreasureName(baseName, remainingQty, itemToMove.goldValue),
                          quantity: remainingQty,
                          weight: (itemToMove.weightPerItem || 0) * remainingQty,
                        };
                      }
                      return item;
                    });
                  }
                }

                if (container.id === targetContainerId) {
                  newItems.push({
                    id: generateId(),
                    name: buildTreasureName(baseName, qtyToTransfer, itemToMove.goldValue),
                    weight: (itemToMove.weightPerItem || 0) * qtyToTransfer,
                    description: itemToMove.description || '',
                    itemType: 'treasure',
                    goldValue: itemToMove.goldValue,
                    quantity: qtyToTransfer,
                    weightPerItem: itemToMove.weightPerItem || 0,
                  });
                }

                return { ...container, items: newItems };
              });
              txn.update(sourceCharRef, { containers: updatedContainers });
            } else {
              const newSourceContainers = sourceCharData.containers.map((container) => {
                if (container.id === sourceContainerId) {
                  let newItems = [...(container.items || [])];
                  if (remainingQty <= 0) {
                    newItems = newItems.filter((item) => item.id !== itemId);
                  } else {
                    newItems = newItems.map((item) => {
                      if (item.id === itemId) {
                        return {
                          ...item,
                          name: buildTreasureName(baseName, remainingQty, itemToMove.goldValue),
                          quantity: remainingQty,
                          weight: (itemToMove.weightPerItem || 0) * remainingQty,
                        };
                      }
                      return item;
                    });
                  }
                  return { ...container, items: newItems };
                }
                return container;
              });

              const newTargetContainers = targetCharData.containers.map((container) => {
                if (container.id === targetContainerId) {
                  return {
                    ...container,
                    items: [
                      ...(container.items || []),
                      {
                        id: generateId(),
                        name: buildTreasureName(baseName, qtyToTransfer, itemToMove.goldValue),
                        weight: (itemToMove.weightPerItem || 0) * qtyToTransfer,
                        description: itemToMove.description || '',
                        itemType: 'treasure',
                        goldValue: itemToMove.goldValue,
                        quantity: qtyToTransfer,
                        weightPerItem: itemToMove.weightPerItem || 0,
                      },
                    ],
                  };
                }
                return container;
              });

              txn.update(sourceCharRef, { containers: newSourceContainers });
              txn.update(targetCharRef, { containers: newTargetContainers });
            }

            return {
              auditDescription: sameChar
                ? null
                : `${qtyToTransfer}x ${baseName} from ${sourceCharData.name}'s ${sourceContainer.name} to ${targetCharData.name}'s ${targetContainer.name}`,
            };
          }

          // Default: full-item move
          if (sameChar) {
            const updatedContainers = sourceCharData.containers.map((container) => {
              let newItems = [...(container.items || [])];
              if (container.id === sourceContainerId) {
                newItems = newItems.filter((item) => item.id !== itemId);
              }
              if (container.id === targetContainerId) {
                if (itemToMove.itemType === 'coins') {
                  newItems = mergeCoinsIntoContainer(newItems, itemToMove);
                } else if (!newItems.some((item) => item.id === itemToMove.id)) {
                  newItems = [...newItems, itemToMove];
                }
              }
              return { ...container, items: newItems };
            });
            txn.update(sourceCharRef, { containers: updatedContainers });
          } else {
            const newSourceContainers = sourceCharData.containers.map((container) => {
              if (container.id === sourceContainerId) {
                return {
                  ...container,
                  items: (container.items || []).filter((item) => item.id !== itemId),
                };
              }
              return container;
            });

            const newTargetContainers = targetCharData.containers.map((container) => {
              if (container.id === targetContainerId) {
                if (itemToMove.itemType === 'coins') {
                  return {
                    ...container,
                    items: mergeCoinsIntoContainer(container.items || [], itemToMove),
                  };
                }
                return {
                  ...container,
                  items: [...(container.items || []), itemToMove],
                };
              }
              return container;
            });

            txn.update(sourceCharRef, { containers: newSourceContainers });
            txn.update(targetCharRef, { containers: newTargetContainers });
          }

          return {
            auditDescription: sameChar
              ? null
              : `item "${itemToMove.name}" from ${sourceCharData.name}'s ${sourceContainer.name} to ${targetCharData.name}'s ${targetContainer.name}`,
          };
        });

        if (result?.error) {
          setModalContent(result.error);
          setShowModal(true);
          return;
        }
        if (result?.auditDescription) {
          await addAuditLogEntry('moved', result.auditDescription);
        }
      } catch (error) {
        console.error("Error transferring item:", error);
        setModalContent(`Error moving item: ${error.message}`);
        setShowModal(true);
      }
    },
    [db, userId, appId, partyId, addAuditLogEntry, partyConfig.coinsPerWeightUnit],
  );

  const handleMoveDraggedItem = useCallback(
    async ({ itemId, sourceCharId, sourceContainerId }, { targetCharId, targetContainerId, targetIndex }) => {
      if (!db || !userId || !partyId) return;
      if (!itemId || !sourceCharId || !sourceContainerId || !targetCharId || !targetContainerId) return;

      try {
        const sourceCharRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          sourceCharId,
        );
        const targetCharRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          targetCharId,
        );
        const sameChar = sourceCharId === targetCharId;

        const result = await runTransaction(db, async (txn) => {
          const sourceCharDoc = await txn.get(sourceCharRef);
          const targetCharDoc = sameChar ? sourceCharDoc : await txn.get(targetCharRef);

          if (!sourceCharDoc.exists() || !targetCharDoc.exists()) {
            return { error: "Error: Source or target character not found." };
          }

          const sourceCharData = normalizeCharacterData(sourceCharDoc.data());
          const targetCharData = sameChar ? sourceCharData : normalizeCharacterData(targetCharDoc.data());
          const sourceContainers = sourceCharData.containers || [];
          const targetContainers = targetCharData.containers || [];
          const sourceContainer = sourceContainers.find((container) => container.id === sourceContainerId);
          const targetContainer = targetContainers.find((container) => container.id === targetContainerId);

          if (!sourceContainer || !targetContainer) {
            return { error: "Error: Source or target container not found." };
          }

          const sourceItems = [...(sourceContainer.items || [])];
          const sourceIndex = sourceItems.findIndex((item) => item.id === itemId);
          if (sourceIndex === -1) {
            return { error: "Error: Item not found." };
          }

          const [itemToMove] = sourceItems.splice(sourceIndex, 1);
          const movingWithinSameContainer = sameChar && sourceContainerId === targetContainerId;
          if (!movingWithinSameContainer) {
            const targetHasMatchingCoinItem =
              itemToMove.itemType === 'coins' &&
              (targetContainer.items || []).some((item) => item.itemType === 'coins');
            const singleItemError = getSingleItemContainerError(
              targetContainer,
              targetHasMatchingCoinItem ? 0 : 1,
            );
            if (singleItemError) return { error: singleItemError };
          }

          const buildCoinItem = (coins, id) => {
            const total =
              (coins.platinum || 0) +
              (coins.gold || 0) +
              (coins.silver || 0) +
              (coins.copper || 0);
            const weight = Math.ceil(total / partyConfig.coinsPerWeightUnit);
            const parts = [];
            if (coins.platinum > 0) parts.push(`${coins.platinum}p`);
            if (coins.gold > 0) parts.push(`${coins.gold}g`);
            if (coins.silver > 0) parts.push(`${coins.silver}s`);
            if (coins.copper > 0) parts.push(`${coins.copper}c`);
            return {
              id,
              name: `$ ${parts.join(' ') || '0c'}`,
              weight,
              description: '',
              itemType: 'coins',
              coins: { ...coins },
            };
          };

          const insertOrMergeMovedItem = (items, insertIndex) => {
            const updatedItems = [...items];
            if (itemToMove.itemType === 'coins' && itemToMove.coins) {
              const existingCoinsIndex = updatedItems.findIndex((item) => item.itemType === 'coins');
              if (existingCoinsIndex !== -1) {
                const existingCoins = updatedItems[existingCoinsIndex];
                const mergedCoins = {
                  platinum: (existingCoins.coins?.platinum || 0) + (itemToMove.coins?.platinum || 0),
                  gold: (existingCoins.coins?.gold || 0) + (itemToMove.coins?.gold || 0),
                  silver: (existingCoins.coins?.silver || 0) + (itemToMove.coins?.silver || 0),
                  copper: (existingCoins.coins?.copper || 0) + (itemToMove.coins?.copper || 0),
                };
                updatedItems[existingCoinsIndex] = buildCoinItem(mergedCoins, existingCoins.id);
                return updatedItems;
              }
            }

            updatedItems.splice(insertIndex, 0, itemToMove);
            return updatedItems;
          };

          if (sameChar && sourceContainerId === targetContainerId) {
            const insertIndex = clampIndex(
              targetIndex > sourceIndex ? targetIndex - 1 : targetIndex,
              0,
              sourceItems.length,
            );
            sourceItems.splice(insertIndex, 0, itemToMove);

            const originalOrder = (sourceContainer.items || []).map((item) => item.id).join('|');
            const newOrder = sourceItems.map((item) => item.id).join('|');
            if (originalOrder === newOrder) return { skip: true };

            const updatedContainers = sourceContainers.map((container) =>
              container.id === sourceContainerId ? { ...container, items: sourceItems } : container,
            );

            txn.update(sourceCharRef, { containers: updatedContainers });
            return { skipAudit: true };
          }

          const targetItems = [...(targetContainer.items || [])];
          const insertIndex = clampIndex(targetIndex, 0, targetItems.length);
          const updatedTargetItems = insertOrMergeMovedItem(targetItems, insertIndex);

          if (sameChar) {
            const updatedContainers = sourceContainers.map((container) => {
              if (container.id === sourceContainerId) {
                return { ...container, items: sourceItems };
              }
              if (container.id === targetContainerId) {
                return { ...container, items: updatedTargetItems };
              }
              return container;
            });

            txn.update(sourceCharRef, { containers: updatedContainers });
            return { skipAudit: true };
          }

          const updatedSourceContainers = sourceContainers.map((container) =>
            container.id === sourceContainerId ? { ...container, items: sourceItems } : container,
          );
          const updatedTargetContainers = targetContainers.map((container) =>
            container.id === targetContainerId ? { ...container, items: updatedTargetItems } : container,
          );

          txn.update(sourceCharRef, { containers: updatedSourceContainers });
          txn.update(targetCharRef, { containers: updatedTargetContainers });

          return {
            auditDescription: `item "${itemToMove.name}" from ${sourceCharData.name}'s ${sourceContainer.name} to ${targetCharData.name}'s ${targetContainer.name}`,
          };
        });

        if (result?.error) {
          setModalContent(result.error);
          setShowModal(true);
          return;
        }
        if (result?.auditDescription) {
          await addAuditLogEntry('moved', result.auditDescription);
        }
      } catch (error) {
        console.error("Error moving dragged item:", error);
        setModalContent(`Error moving item: ${error.message}`);
        setShowModal(true);
      }
    },
    [db, userId, appId, partyId, addAuditLogEntry, partyConfig.coinsPerWeightUnit],
  );

  const getDraggedItemFromEvent = useCallback((event) => {
    const rawData =
      event.dataTransfer?.getData(ITEM_DRAG_MIME_TYPE) ||
      event.dataTransfer?.getData('text/plain');

    if (rawData) {
      try {
        return JSON.parse(rawData);
      } catch (error) {
        console.error("Error reading dragged item data:", error);
      }
    }

    return draggedItem;
  }, [draggedItem]);

  const handleItemDragStart = useCallback((event, dragData) => {
    event.stopPropagation();
    const payload = JSON.stringify(dragData);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(ITEM_DRAG_MIME_TYPE, payload);
    event.dataTransfer.setData('text/plain', payload);
    setDraggedItem(dragData);
  }, []);

  const handleItemDragOver = useCallback((event, targetCharId, targetContainerId, itemIndex) => {
    if (!draggedItem) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget({
      targetCharId,
      targetContainerId,
      targetIndex: getDropIndexFromPointer(event, itemIndex),
    });
  }, [draggedItem]);

  const handleContainerDragOver = useCallback((event, targetCharId, targetContainerId, targetIndex) => {
    if (!draggedItem) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget({ targetCharId, targetContainerId, targetIndex });
  }, [draggedItem]);

  const handleItemDrop = useCallback(
    async (event, targetCharId, targetContainerId, targetIndex) => {
      event.preventDefault();
      event.stopPropagation();
      const dragData = getDraggedItemFromEvent(event);
      setDraggedItem(null);
      setDropTarget(null);

      if (!dragData) return;
      await handleMoveDraggedItem(dragData, { targetCharId, targetContainerId, targetIndex });
    },
    [getDraggedItemFromEvent, handleMoveDraggedItem],
  );

  const handleItemDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDropTarget(null);
  }, []);

  // Handler to identify an unidentified item
  const handleIdentifyItem = useCallback(
    async (charId, containerId, itemId) => {
      if (!db || !userId || !partyId) return;

      try {
        const characterRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          charId,
        );

        const result = await runTransaction(db, async (txn) => {
          const characterDoc = await txn.get(characterRef);
          if (!characterDoc.exists()) return null;

          const characterData = normalizeCharacterData(characterDoc.data());
          let identifiedItemName = '';

          const updatedContainers = characterData.containers.map((container) => {
            if (container.id === containerId) {
              const updatedItems = (container.items || []).map((item) => {
                if (item.id === itemId && item.isUnidentified) {
                  identifiedItemName = item.secretName || item.name;
                  return {
                    id: item.id,
                    name: item.secretName || item.name,
                    weight: item.weight,
                    description: item.secretDescription || item.description || '',
                  };
                }
                return item;
              });
              return { ...container, items: updatedItems };
            }
            return container;
          });

          if (!identifiedItemName) return null;
          txn.update(characterRef, { containers: updatedContainers });
          const container = characterData.containers.find(c => c.id === containerId);
          return { identifiedItemName, characterName: characterData.name, containerName: container?.name };
        });

        if (result) {
          await addAuditLogEntry(
            'identified',
            `item revealed as "${result.identifiedItemName}" in ${result.characterName}'s ${result.containerName || 'container'}`
          );
        }
      } catch (error) {
        console.error("Error identifying item:", error);
        setModalContent(`Error identifying item: ${error.message}`);
        setShowModal(true);
      }
    },
    [db, userId, appId, partyId, addAuditLogEntry, partyConfig.coinsPerWeightUnit],
  );

  // Handler to save/update a coin item
  const handleSaveCoinItem = useCallback(
    async (charId, containerId, itemId, coins) => {
      if (!db || !userId || !partyId) return;

      try {
        const characterRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          charId,
        );

        const result = await runTransaction(db, async (txn) => {
          const characterDoc = await txn.get(characterRef);
          if (!characterDoc.exists()) return null;

          const characterData = normalizeCharacterData(characterDoc.data());
          const container = characterData.containers.find(c => c.id === containerId);
          const oldItem = container?.items?.find((item) => item.id === itemId);
          if (!oldItem) return null;

          const totalCoins = (coins.platinum || 0) + (coins.gold || 0) + (coins.silver || 0) + (coins.copper || 0);
          const coinWeight = Math.ceil(totalCoins / partyConfig.coinsPerWeightUnit);
          const parts = [];
          if (coins.platinum > 0) parts.push(`${coins.platinum}p`);
          if (coins.gold > 0) parts.push(`${coins.gold}g`);
          if (coins.silver > 0) parts.push(`${coins.silver}s`);
          if (coins.copper > 0) parts.push(`${coins.copper}c`);
          const coinName = `$ ${parts.join(' ') || '0c'}`;

          const updatedContainers = characterData.containers.map((container) => {
            if (container.id === containerId) {
              const updatedItems = (container.items || []).map((item) => {
                if (item.id === itemId) {
                  return {
                    ...item,
                    name: coinName,
                    weight: coinWeight,
                    coins: { ...coins },
                  };
                }
                return item;
              });
              return { ...container, items: updatedItems };
            }
            return container;
          });

          txn.update(characterRef, { containers: updatedContainers });
          return {
            characterName: characterData.name,
            containerName: container?.name,
            delta: getCoinDelta(oldItem.coins, coins),
          };
        });

        if (result) {
          const coinDeltaText = formatCoinDelta(result.delta);
          if (coinDeltaText !== 'no change') {
            await addAuditLogEntry(
              'edited',
              `coins in ${result.characterName}'s ${result.containerName || 'container'}: ${coinDeltaText}`
            );
          }
        }
      } catch (error) {
        console.error("Error saving coin item:", error);
        setModalContent(`Error saving coins: ${error.message}`);
        setShowModal(true);
      }
    },
    [db, userId, appId, partyId, addAuditLogEntry, partyConfig.coinsPerWeightUnit],
  );

  const handleUpdateCountedItemCount = useCallback(
    async (charId, containerId, itemId, delta) => {
      if (!db || !userId || !partyId) return;

      try {
        const characterRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          charId,
        );

        const result = await runTransaction(db, async (txn) => {
          const characterDoc = await txn.get(characterRef);
          if (!characterDoc.exists()) return null;

          const characterData = normalizeCharacterData(characterDoc.data());
          const container = characterData.containers.find((c) => c.id === containerId);
          const item = container?.items?.find((i) => i.id === itemId);
          const counted = parseCountedItemName(item?.name);
          if (!container || !item || !counted) return null;

          const newCount = Math.max(0, counted.count + delta);
          if (newCount === counted.count) return { skip: true };
          const newName = formatCountedItemName(counted.baseName, newCount);

          const updatedContainers = characterData.containers.map((cont) => {
            if (cont.id === containerId) {
              return {
                ...cont,
                items: (cont.items || []).map((currentItem) => (
                  currentItem.id === itemId
                    ? { ...currentItem, name: newName }
                    : currentItem
                )),
              };
            }
            return cont;
          });

          txn.update(characterRef, { containers: updatedContainers });
          return {
            baseName: counted.baseName,
            oldCount: counted.count,
            newCount,
            characterName: characterData.name,
            containerName: container.name,
          };
        });

        if (result && !result.skip) {
          const deltaText = result.newCount - result.oldCount > 0
            ? `+${result.newCount - result.oldCount}`
            : `${result.newCount - result.oldCount}`;
          await addAuditLogEntry(
            'edited',
            `item count "${result.baseName}": ${deltaText} to ${result.newCount} in ${result.characterName}'s ${result.containerName || 'container'}`
          );
        }
      } catch (error) {
        console.error("Error updating counted item:", error);
        setModalContent(`Error updating item count: ${error.message}`);
        setShowModal(true);
      }
    },
    [db, userId, appId, partyId, addAuditLogEntry],
  );

  // Handler to liquidate treasure into gold coins
  const handleLiquidateTreasure = useCallback(
    async (charId, containerId, itemId, goldValue, quantityToLiquidate = 1) => {
      if (!db || !userId || !partyId) return;

      try {
        const characterRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          charId,
        );

        const result = await runTransaction(db, async (txn) => {
          const characterDoc = await txn.get(characterRef);
          if (!characterDoc.exists()) return null;

          const characterData = normalizeCharacterData(characterDoc.data());
          const container = characterData.containers.find(c => c.id === containerId);
          const treasureItem = container?.items?.find(i => i.id === itemId);
          if (!treasureItem) return null;

          const currentQty = treasureItem.quantity || 1;
          const qtyToLiquidate = Math.min(quantityToLiquidate, currentQty);
          const remainingQty = currentQty - qtyToLiquidate;

          const existingCoinsIndex = (container.items || []).findIndex(item =>
            item.itemType === 'coins' && item.id !== itemId
          );
          if (isSingleItemEquippedContainer(container) && remainingQty > 0) {
            return {
              error: `${container.name} can only hold one item. Liquidate the full stack before converting it to coins here.`,
            };
          }

          const updateTreasureItem = (items) => {
            if (remainingQty <= 0) {
              return items.filter(item => item.id !== itemId);
            }
            return items.map(item => {
              if (item.id === itemId) {
                let baseName = item.name.replace(/^\d+x\s*/, '').replace(/\s*\(\d+g\)\s*$/, '').trim();
                const newName = remainingQty > 1
                  ? `${remainingQty}x ${baseName} (${treasureItem.goldValue}g)`
                  : `${baseName} (${treasureItem.goldValue}g)`;
                const newWeight = (treasureItem.weightPerItem || 0) * remainingQty;
                return {
                  ...item,
                  name: newName,
                  quantity: remainingQty,
                  weight: newWeight,
                };
              }
              return item;
            });
          };

          let updatedContainers;

          if (existingCoinsIndex !== -1) {
            updatedContainers = characterData.containers.map((cont) => {
              if (cont.id === containerId) {
                let items = [...(cont.items || [])];
                const existingCoins = items[existingCoinsIndex];

                const mergedCoins = {
                  platinum: existingCoins.coins?.platinum || 0,
                  gold: (existingCoins.coins?.gold || 0) + goldValue,
                  silver: existingCoins.coins?.silver || 0,
                  copper: existingCoins.coins?.copper || 0,
                };
                const totalCoins = mergedCoins.platinum + mergedCoins.gold + mergedCoins.silver + mergedCoins.copper;
                const coinWeight = Math.ceil(totalCoins / partyConfig.coinsPerWeightUnit);
                const parts = [];
                if (mergedCoins.platinum > 0) parts.push(`${mergedCoins.platinum}p`);
                if (mergedCoins.gold > 0) parts.push(`${mergedCoins.gold}g`);
                if (mergedCoins.silver > 0) parts.push(`${mergedCoins.silver}s`);
                if (mergedCoins.copper > 0) parts.push(`${mergedCoins.copper}c`);
                const coinName = `$ ${parts.join(' ') || '0c'}`;

                items[existingCoinsIndex] = {
                  ...existingCoins,
                  name: coinName,
                  weight: coinWeight,
                  coins: mergedCoins,
                };

                items = updateTreasureItem(items);
                return { ...cont, items };
              }
              return cont;
            });
          } else {
            const newCoins = {
              platinum: 0,
              gold: goldValue,
              silver: 0,
              copper: 0,
            };
            const coinWeight = Math.ceil(goldValue / partyConfig.coinsPerWeightUnit);
            const coinName = `$ ${goldValue}g`;

            updatedContainers = characterData.containers.map((cont) => {
              if (cont.id === containerId) {
                let items = updateTreasureItem([...(cont.items || [])]);
                items.push({
                  id: generateId(),
                  name: coinName,
                  weight: coinWeight,
                  description: '',
                  itemType: 'coins',
                  coins: newCoins,
                });
                return { ...cont, items };
              }
              return cont;
            });
          }

          txn.update(characterRef, { containers: updatedContainers });
          return {
            qtyToLiquidate,
            treasureName: treasureItem.name,
            characterName: characterData.name,
            containerName: container?.name,
          };
        });

        if (result?.error) {
          setModalContent(result.error);
          setShowModal(true);
        } else if (result) {
          const qtyText = result.qtyToLiquidate > 1 ? `${result.qtyToLiquidate}x ` : '';
          await addAuditLogEntry(
            'edited',
            `liquidated ${qtyText}"${result.treasureName}" into ${goldValue} gold in ${result.characterName}'s ${result.containerName || 'container'}`
          );
        }
      } catch (error) {
        console.error("Error liquidating treasure:", error);
        setModalContent(`Error liquidating treasure: ${error.message}`);
        setShowModal(true);
      }
    },
    [db, userId, appId, partyId, addAuditLogEntry, partyConfig.coinsPerWeightUnit],
  );

  // Handler to import multiple items from JSON
  const handleImportItems = useCallback(
    async (items) => {
      if (!db || !userId || !partyId || !importTarget) return;

      const { charId, containerId, containerName } = importTarget;

      try {
        const characterRef = doc(
          db,
          `artifacts/${appId}/public/data/dnd_inventory/${partyId}/characters`,
          charId,
        );

        const characterNameResult = await runTransaction(db, async (txn) => {
          const characterDoc = await txn.get(characterRef);
          if (!characterDoc.exists()) return null;

          const characterData = normalizeCharacterData(characterDoc.data());

          const itemsWithIds = items.map(item => ({
            ...item,
            id: generateId(),
          }));

          const coinItems = itemsWithIds.filter(item => item.itemType === 'coins');
          const nonCoinItems = itemsWithIds.filter(item => item.itemType !== 'coins');
          const targetContainer = characterData.containers.find((container) => container.id === containerId);
          if (!targetContainer) return { error: "Error: Container not found." };
          const hasExistingCoinItem = (targetContainer.items || []).some((item) => item.itemType === 'coins');
          const incomingItemCount = nonCoinItems.length + (coinItems.length > 0 && !hasExistingCoinItem ? 1 : 0);
          const singleItemError = getSingleItemContainerError(targetContainer, incomingItemCount);
          if (singleItemError) return { error: singleItemError };

          const updatedContainers = characterData.containers.map((container) => {
            if (container.id === containerId) {
              let newItems = [...(container.items || []), ...nonCoinItems];

              if (coinItems.length > 0) {
                const importedCoins = coinItems.reduce((acc, item) => ({
                  platinum: acc.platinum + (item.coins?.platinum || 0),
                  gold: acc.gold + (item.coins?.gold || 0),
                  silver: acc.silver + (item.coins?.silver || 0),
                  copper: acc.copper + (item.coins?.copper || 0),
                }), { platinum: 0, gold: 0, silver: 0, copper: 0 });

                const existingCoinsIndex = newItems.findIndex(item => item.itemType === 'coins');

                if (existingCoinsIndex !== -1) {
                  const existingCoins = newItems[existingCoinsIndex];
                  const mergedCoins = {
                    platinum: (existingCoins.coins?.platinum || 0) + importedCoins.platinum,
                    gold: (existingCoins.coins?.gold || 0) + importedCoins.gold,
                    silver: (existingCoins.coins?.silver || 0) + importedCoins.silver,
                    copper: (existingCoins.coins?.copper || 0) + importedCoins.copper,
                  };
                  const totalCoins = mergedCoins.platinum + mergedCoins.gold + mergedCoins.silver + mergedCoins.copper;
                  const coinWeight = Math.ceil(totalCoins / partyConfig.coinsPerWeightUnit);
                  const parts = [];
                  if (mergedCoins.platinum > 0) parts.push(`${mergedCoins.platinum}p`);
                  if (mergedCoins.gold > 0) parts.push(`${mergedCoins.gold}g`);
                  if (mergedCoins.silver > 0) parts.push(`${mergedCoins.silver}s`);
                  if (mergedCoins.copper > 0) parts.push(`${mergedCoins.copper}c`);

                  newItems[existingCoinsIndex] = {
                    ...existingCoins,
                    name: `$ ${parts.join(' ') || '0c'}`,
                    weight: coinWeight,
                    coins: mergedCoins,
                  };
                } else {
                  const totalCoins = importedCoins.platinum + importedCoins.gold + importedCoins.silver + importedCoins.copper;
                  const coinWeight = Math.ceil(totalCoins / partyConfig.coinsPerWeightUnit);
                  const parts = [];
                  if (importedCoins.platinum > 0) parts.push(`${importedCoins.platinum}p`);
                  if (importedCoins.gold > 0) parts.push(`${importedCoins.gold}g`);
                  if (importedCoins.silver > 0) parts.push(`${importedCoins.silver}s`);
                  if (importedCoins.copper > 0) parts.push(`${importedCoins.copper}c`);

                  newItems.push({
                    id: generateId(),
                    name: `$ ${parts.join(' ') || '0c'}`,
                    weight: coinWeight,
                    description: '',
                    itemType: 'coins',
                    coins: importedCoins,
                  });
                }
              }

              return { ...container, items: newItems };
            }
            return container;
          });

          txn.update(characterRef, { containers: updatedContainers });
          return characterData.name;
        });

        if (characterNameResult?.error) {
          setModalContent(characterNameResult.error);
          setShowModal(true);
        } else if (characterNameResult) {
          await addAuditLogEntry(
            'created',
            `imported ${items.length} item(s) into ${characterNameResult}'s ${containerName}`
          );
        }
      } catch (error) {
        console.error("Error importing items:", error);
        setModalContent(`Error importing items: ${error.message}`);
        setShowModal(true);
      }
    },
    [db, userId, appId, partyId, importTarget, addAuditLogEntry, partyConfig.coinsPerWeightUnit],
  );


  const renderSpeedText = (speed) => (
    <span className={speed === 'Overloaded' ? 'text-red-300' : ''}>
      {speed}
    </span>
  );

  const renderSectionHeader = (label, speed, slots) => (
    <div className="mt-2 px-2 py-1 rounded-md bg-gray-900/70 border border-gray-600 text-gray-200 font-semibold flex items-center justify-between gap-2">
      <span>{label} (max {renderSpeedText(speed)})</span>
      <span className="text-yellow-200 text-sm font-medium shrink-0">
        {formatWeightValue(slots)} slots
      </span>
    </div>
  );

  const renderContainerCard = (char, container, options = {}) => {
    const { allowCollapse = true, title = container.name, allowDetails = !isProgrammaticEquippedContainer(container) } = options;
    const currentContainerWeight = calculateContainerWeight(container);
    const isProgrammaticEquipped = isProgrammaticEquippedContainer(container);
    const isSingleItemEquipped = isSingleItemEquippedContainer(container);
    const isOverCapacity =
      !isProgrammaticEquipped &&
      container.maxCapacity !== undefined &&
      currentContainerWeight > container.maxCapacity;
    const containerItems = container.items || [];
    const addDisabledReason = getSingleItemContainerError(container, 1);
    const isCollapsed = allowCollapse &&
      (!Object.prototype.hasOwnProperty.call(collapsedContainers, container.id) ||
        collapsedContainers[container.id]);
    const isContainerDropTarget =
      dropTarget?.targetCharId === char.id &&
      dropTarget?.targetContainerId === container.id;
    const isDropIndex = (index) =>
      isContainerDropTarget && dropTarget?.targetIndex === index;

    return (
      <div
        key={container.id}
        className={`bg-gray-700 rounded-lg p-2 shadow-md transition-all duration-200
                                    ${isOverCapacity ? "border-4 border-red-500" : "border border-gray-600"}
                                `}
        onClick={(e) => {
          e.stopPropagation();
          if (!allowDetails) return;
          setSelectedContainerForDetails({
            container,
            charId: char.id,
          });
          setShowContainerDetailsModal(true);
        }}
      >
        <h3
          className={`text-lg font-semibold text-gray-200 mb-1 border-b border-gray-500 pb-1 flex items-center rounded-t-md transition-colors ${
            isContainerDropTarget && dropTarget?.targetIndex === 0 ? 'bg-blue-900/30' : ''
          }`}
          onDragOver={(e) => handleContainerDragOver(e, char.id, container.id, 0)}
          onDrop={(e) => handleItemDrop(e, char.id, container.id, 0)}
        >
          {allowCollapse ? (
            isCollapsed ? (
              <button
                className="bg-transparent p-0 border-none mr-2 items-center focus-visible:outline-0 focus:outline-0 text-gray-400"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExpandContainer(container.id);
                }}
              >
                &gt;
              </button>
            ) : (
              <button
                className="bg-transparent p-0 border-none mr-2 items-center focus-visible:outline-0 focus:outline-0 text-gray-400"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCollapseContainer(container.id);
                }}
              >
                v
              </button>
            )
          ) : (
            <span className="mr-2 w-3" aria-hidden="true" />
          )}
          <span className="flex-grow">{title}</span>
          {!isSingleItemEquipped && !isProgrammaticEquipped && (
            <span className="text-yellow-200 ml-auto text-sm font-medium">
              {`${formatWeightValue(currentContainerWeight)} / ${formatPartyWeight(container.maxCapacity)}`}
            </span>
          )}
        </h3>
        {isCollapsed ? (
          <></>
        ) : (
          <>
            <div
              className={`space-y-1 min-h-10 rounded-md transition-colors ${isContainerDropTarget ? 'bg-blue-900/20' : ''}`}
              onDragOver={(e) => handleContainerDragOver(e, char.id, container.id, containerItems.length)}
              onDrop={(e) => handleItemDrop(e, char.id, container.id, containerItems.length)}
            >
              {containerItems.length === 0 ? (
                <p
                  className={`text-gray-400 text-sm italic rounded-md border border-dashed px-3 py-2 ${isDropIndex(0) ? 'border-blue-400 bg-blue-900/30' : 'border-gray-600'}`}
                >
                  {isSingleItemEquipped ? "Drop one item here." : "Drop items here, or click '+' to add items."}
                </p>
              ) : (
                containerItems.map((item, index) => {
                  const isDraggedItem =
                    draggedItem?.itemId === item.id &&
                    draggedItem?.sourceCharId === char.id &&
                    draggedItem?.sourceContainerId === container.id;
                  const showDropBefore = isDropIndex(index);
                  const showDropAfter = isDropIndex(index + 1);
                  const countedItem = parseCountedItemName(item.name);

                  return (
                    <div
                      key={item.id}
                      onDragOver={(e) => handleItemDragOver(e, char.id, container.id, index)}
                      onDrop={(e) => handleItemDrop(e, char.id, container.id, getDropIndexFromPointer(e, index))}
                      className={`flex items-center bg-gray-600 rounded-md shadow-sm transition-all duration-200 hover:bg-gray-500 border-y-2 ${
                        showDropBefore ? 'border-t-blue-400' : 'border-t-transparent'
                      } ${
                        showDropAfter ? 'border-b-blue-400' : 'border-b-transparent'
                      } ${isDraggedItem ? 'opacity-50' : ''}`}
                    >
                      <span
                        role="button"
                        aria-label="Drag item"
                        title="Drag to reorder or move item"
                        tabIndex={0}
                        draggable
                        onClick={(e) => e.stopPropagation()}
                        onDragStart={(e) => handleItemDragStart(e, {
                          itemId: item.id,
                          sourceCharId: char.id,
                          sourceContainerId: container.id,
                        })}
                        onDragEnd={handleItemDragEnd}
                        className="self-stretch flex items-center px-2 border-r border-gray-500 text-gray-300 hover:text-white hover:bg-gray-500 rounded-l-md cursor-grab active:cursor-grabbing select-none"
                      >
                        ⠿
                      </span>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItemForDetails({
                            item,
                            charId: char.id,
                            containerId: container.id,
                          });
                          setShowItemDetailsModal(true);
                        }}
                        className="flex-1 flex justify-between items-center gap-2 px-3 py-2 cursor-pointer min-w-0"
                      >
                        <span className="flex items-center gap-1 min-w-0">
                          <span className={`text-base truncate ${
                            item.isUnidentified ? 'text-purple-300' :
                            item.itemType === 'coins' ? 'text-yellow-300' :
                            item.itemType === 'treasure' ? 'text-emerald-300' :
                            'text-white'
                          }`}>
                            {item.isUnidentified && <span className="mr-1">?</span>}
                            {item.itemType === 'treasure' && <span className="mr-1">*</span>}
                            {item.itemType === 'coins' && item.coins
                              ? `$ ${formatCoins(item.coins)}`
                              : item.name}
                          </span>
                          {countedItem && item.itemType !== 'coins' && (
                            <span className="inline-flex items-center gap-0.5 ml-1 rounded border border-gray-500 bg-gray-700/70 text-xs text-gray-200 overflow-hidden shrink-0">
                              <button
                                type="button"
                                aria-label={`Decrease ${countedItem.baseName} count`}
                                title="Decrease count"
                                className="px-1 py-0.5 leading-none bg-transparent hover:bg-gray-600 focus:outline-none"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateCountedItemCount(char.id, container.id, item.id, -1);
                                }}
                              >
                                −
                              </button>
                              <button
                                type="button"
                                aria-label={`Increase ${countedItem.baseName} count`}
                                title="Increase count"
                                className="px-1 py-0.5 leading-none bg-transparent hover:bg-gray-600 focus:outline-none border-l border-gray-500"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateCountedItemCount(char.id, container.id, item.id, 1);
                                }}
                              >
                                +
                              </button>
                            </span>
                          )}
                        </span>
                        <span className="text-yellow-200 text-sm font-medium shrink-0">
                          {formatPartyWeight(item.weight)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {!isSingleItemEquipped && (
              <div className="mt-1 flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (addDisabledReason) {
                      setModalContent(addDisabledReason);
                      setShowModal(true);
                      return;
                    }
                    handleAddItemClick(char.id, container.id);
                  }}
                  disabled={Boolean(addDisabledReason)}
                  title={addDisabledReason || "Add item"}
                  className={`flex-1 text-white font-bold py-1 px-2 rounded-lg text-sm shadow transform transition duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${
                    addDisabledReason
                      ? 'bg-gray-500 cursor-not-allowed opacity-70'
                      : 'bg-blue-600 hover:bg-blue-700 hover:scale-105'
                  }`}
                >
                  + Add Item
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setImportTarget({
                      charId: char.id,
                      containerId: container.id,
                      containerName: container.name,
                    });
                    setShowImportItemsModal(true);
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-1 px-2 rounded-lg text-sm shadow transform transition duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
                  title="Import items from JSON"
                >
                  {"{ }"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
          <p className="mt-4 text-lg">Loading inventory...</p>
        </div>
      </div>
    );
  }

  if (!partyId) {
    console.error(
      "Rendering fallback: partyId is missing in InventoryAppContent. This shouldn't happen if InitialPartyRedirect works.",
    );
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <p className="text-xl text-red-400 text-center">
          Error: Party ID not found in URL. This usually means the initial
          redirect failed or routing is misconfigured. Please check your console
          for errors.
        </p>
        <button
          onClick={() => navigate("/", { replace: true })}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg mt-4"
        >
          Go Home / Try New Party
        </button>
      </div>
    );
  }

  return (
    <PartyConfigContext.Provider value={partyConfig}>
    <div className="min-h-screen bg-gray-900 text-white font-inter p-1 sm:p-8">
      <Modal
        show={showModal}
        onClose={() => {
          setShowModal(false);
          setModalOnConfirm(null);
        }}
        message={modalContent}
        onConfirm={modalOnConfirm}
        confirmText="Delete"
        cancelText="Cancel"
      />
      <GenericInputModal
        show={showGenericInputModal}
        onClose={() => setShowGenericInputModal(false)}
        title={genericInputModalConfig.title}
        placeholder={genericInputModalConfig.placeholder}
        onSubmit={genericInputModalConfig.onSubmit}
      />
      <AddItemInputModal
        show={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        onSubmit={handleAddItemSubmit}
      />
      <DeleteConfirmationModal
        show={showDeleteCharacterConfirmModal}
        onClose={() => {
          setShowDeleteCharacterConfirmModal(false);
          setCharacterToDelete(null);
        }}
        onConfirm={deleteCharacter}
        targetName={characterToDelete ? characterToDelete.name : ""}
        requiredText="delete"
      />
      <AddContainerModal
        show={showAddContainerModal}
        onClose={() => {
          setShowAddContainerModal(false);
          setAddContainerModalTargetCharId(null);
        }}
        onSubmit={handleAddContainerSubmit}
      />
      {selectedItemForDetails && (() => {
        // Look up the live item from current characters data to avoid stale snapshots
        const liveChar = characters.find(c => c.id === selectedItemForDetails.charId);
        const liveContainer = liveChar?.containers?.find(c => c.id === selectedItemForDetails.containerId);
        const liveItem = liveContainer?.items?.find(i => i.id === selectedItemForDetails.item.id) || selectedItemForDetails.item;
        return (
        <ItemDetailsModal
          handleDelete={() =>
            handleDeleteItem(
              selectedItemForDetails.charId,
              selectedItemForDetails.containerId,
              selectedItemForDetails.item.id,
            )
          }
          show={showItemDetailsModal}
          onClose={() => {
            setShowItemDetailsModal(false);
            setSelectedItemForDetails(null);
          }}
          item={liveItem}
          onSaveDescription={(itemId, newName, newWeight, newDescription) =>
            updateItemDescription(itemId, newName, newWeight, newDescription)
          }
          characters={characters}
          currentCharId={selectedItemForDetails.charId}
          currentContainerId={selectedItemForDetails.containerId}
          onTransfer={(targetCharId, targetContainerId, partialData) =>
            handleTransferItem(
              selectedItemForDetails.item.id,
              selectedItemForDetails.charId,
              selectedItemForDetails.containerId,
              targetCharId,
              targetContainerId,
              partialData
            )
          }
          onIdentify={() =>
            handleIdentifyItem(
              selectedItemForDetails.charId,
              selectedItemForDetails.containerId,
              selectedItemForDetails.item.id
            )
          }
          onSaveCoinItem={(itemId, coins) =>
            handleSaveCoinItem(
              selectedItemForDetails.charId,
              selectedItemForDetails.containerId,
              itemId,
              coins
            )
          }
          onSaveItem={(itemId, updatedFields) =>
            handleSaveItem(itemId, updatedFields)
          }
          onLiquidateTreasure={(itemId, goldValue, quantity) =>
            handleLiquidateTreasure(
              selectedItemForDetails.charId,
              selectedItemForDetails.containerId,
              itemId,
              goldValue,
              quantity
            )
          }
        />
        );
      })()}
      {selectedContainerForDetails && (
        <ContainerDetailsModal
          show={showContainerDetailsModal}
          onClose={() => {
            setShowContainerDetailsModal(false);
            setSelectedContainerForDetails(null);
          }}
          container={selectedContainerForDetails.container}
          onSaveContainer={(
            containerId,
            newName,
            newWeight,
            newMaxCapacityPounds,
            newDescription,
          ) =>
            handleSaveContainerDetails(
              selectedContainerForDetails.charId,
              containerId,
              newName,
              newWeight,
              newMaxCapacityPounds,
              newDescription,
            )
          }
          onDeleteContainer={(containerId, containerName) =>
            handleDeleteContainer(
              selectedContainerForDetails.charId,
              containerId,
              containerName,
            )
          }
          onTransferAll={() => {
            setTransferAllSource({
              charId: selectedContainerForDetails.charId,
              containerId: selectedContainerForDetails.container.id,
              containerName: selectedContainerForDetails.container.name
            });
            setShowTransferAllModal(true);
          }}
        />
      )}
      {selectedCharacterForDetails && (
        <CharacterDetailsModal
          show={showCharacterDetailsModal}
          onClose={() => {
            setShowCharacterDetailsModal(false);
            setSelectedCharacterForDetails(null);
          }}
          character={selectedCharacterForDetails}
          onSaveCharacter={(id, newName, newStrengthModifier) =>
            handleSaveCharacterDetails(id, newName, newStrengthModifier)
          }
          onDeleteCharacter={() =>
            handleDeleteCharacterConfirmation(
              selectedCharacterForDetails.id,
              selectedCharacterForDetails.name,
            )
          }
          onSendCharacterToBottom={() =>
            handleSendCharacterToBottom(selectedCharacterForDetails.id)
          }
        />
      )}
      <AuditLogModal
        show={showAuditLogModal}
        onClose={() => setShowAuditLogModal(false)}
        auditLog={auditLog}
      />
      <TransferAllItemsModal
        show={showTransferAllModal}
        onClose={() => {
          setShowTransferAllModal(false);
          setTransferAllSource(null);
        }}
        onConfirm={handleTransferAllItems}
        characters={characters}
        sourceCharId={transferAllSource?.charId}
        sourceContainerId={transferAllSource?.containerId}
      />
      <ImportItemsModal
        show={showImportItemsModal}
        onClose={() => {
          setShowImportItemsModal(false);
          setImportTarget(null);
        }}
        onImport={handleImportItems}
      />
      <HelpModal
        show={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
      <PartyConfigModal
        show={showPartyConfigModal}
        onClose={() => setShowPartyConfigModal(false)}
        config={partyConfig}
        onSave={handleSavePartyConfig}
        onExportBackup={handleExportBackup}
        onRestoreBackup={handleRestoreBackup}
      />

      <div className="flex flex-col items-center mb-8">
        <div className="flex gap-4">
          <button
            onClick={handleAddCharacterClick}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-500 focus:ring-opacity-50"
          >
            + Add New Character
          </button>
          <button
            onClick={() => setShowAuditLogModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50"
          >
            📋 Audit Log
          </button>
          <button
            onClick={() => setShowPartyConfigModal(true)}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-gray-500 focus:ring-opacity-50"
          >
            ⚙ Settings
          </button>
        </div>
      </div>

      <div>
        {characters.length === 0 ? (
          <p className="text-center text-gray-400 text-xl">
            No characters yet. Add one to get started!
          </p>
        ) : (
          <div className="flex gap-6 items-start">
            {Array.from({ length: columnCount }, (_, colIndex) => {
              const perCol = Math.ceil(characters.length / columnCount);
              const colChars = characters.slice(colIndex * perCol, (colIndex + 1) * perCol);
              return (
              <div key={colIndex} className="flex-1 flex flex-col gap-4 min-w-0">
                {colChars.map((char) => (
            <div
              key={char.id}
              className={`bg-gray-800 rounded-xl shadow-lg p-3 border-2 flex flex-col transition-all duration-300 hover:shadow-xl ${calculateCharacterEncumbrance(char).speed === 'Overloaded' ? 'border-red-500 hover:border-red-400' : 'border-blue-600 hover:border-blue-500'}`}
              onClick={() => {
                setSelectedCharacterForDetails(char);
                setShowCharacterDetailsModal(true);
              }}
            >
              <div className="flex justify-between items-center mb-2 border-b border-blue-700 pb-1">
                <h2 className="text-xl font-bold text-blue-300 flex text-left">
                  {!Object.prototype.hasOwnProperty.call(collapsedCharacters, char.id) || collapsedCharacters[char.id] ? (
                    <button
                      className="bg-transparent p-0 border-none mr-3 items-center focus-visible:outline-0 focus:outline-0 text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExpandCharacter(char.id);
                      }}
                    >
                      &gt;
                    </button>
                  ) : (
                    <button
                      className="bg-transparent p-0 border-none mr-3 items-center focus-visible:outline-0 focus:outline-0 text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCollapseCharacter(char.id);
                      }}
                    >
                      v
                    </button>
                  )}
                  {char.name}
                </h2>
                {(() => {
                  const encumbrance = calculateCharacterEncumbrance(char);
                  const overloaded = encumbrance.speed === 'Overloaded';
                  return (
                    <span className={`${overloaded ? 'text-red-300' : 'text-yellow-200'} text-sm sm:text-base float-right text-right font-semibold`}>
                      {encumbrance.speed}
                    </span>
                  );
                })()}
              </div>

              {!Object.prototype.hasOwnProperty.call(collapsedCharacters, char.id) || collapsedCharacters[char.id] ? (
                <></>
              ) : (
                <div className="flex flex-col gap-2 flex-grow">
                  {(() => {
                    const encumbrance = calculateCharacterEncumbrance(char);
                    const { equippedContainers, stowedContainers } = splitEquippedAndStowedContainers(char.containers || []);

                    return (
                      <>
                        {renderSectionHeader('Equipped', encumbrance.equippedSpeed, encumbrance.equipped)}
                        {equippedContainers.map((container) => renderContainerCard(char, container, {
                          allowCollapse: false,
                          allowDetails: false,
                        }))}
                        {renderSectionHeader('Stowed', encumbrance.stowedSpeed, encumbrance.packed)}
                        {stowedContainers.map((container) => renderContainerCard(char, container))}
                      </>
                    );
                  })()}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddContainerClick(char.id);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1 px-2 rounded-lg text-sm shadow transform transition duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 mt-1"
                  >
                    + Add Container
                  </button>
                </div>
              )}
            </div>
          ))}
              </div>
              );
            })}
          </div>
        )}
      </div>

      <footer className="mt-12 pt-6 border-t border-gray-700 flex justify-center items-center gap-6 text-sm text-gray-400">
        <button
          onClick={() => setShowHelpModal(true)}
          className="hover:text-gray-200 transition-colors"
        >
          ? Help
        </button>
        <a
          href="https://github.com/beaurancourt/ttrpg-inventory"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-200 transition-colors"
        >
          GitHub
        </a>
      </footer>
    </div>
    </PartyConfigContext.Provider>
  );
}
