import { Observable } from 'rxjs';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { Firestore, limit } from 'firebase/firestore'
import { getFirestore, collection, getDocs, getDoc, doc, 
         DocumentData, CollectionReference, query, where, onSnapshot } from 'firebase/firestore';
import { Collection, Transaction, TransactionType } from './interfaces/models';
import { COL } from './interfaces/models/base';
import { Nft } from './interfaces/models/nft';

/**
 * Public class to interact with Soonaverse.
 */
export class Soon {
  public static app: FirebaseApp;
  /**
   * We connect to soonaverse as part of the contract. We only create one connection.
   */
  constructor() {
    if (!Soon.app) {
      Soon.app = initializeApp({
        apiKey: "AIzaSyB4fcG8rtNWAiAtSmxmK3q3JLfMvtNCGP4",
        projectId: "soonaverse"
      });
    }
  }

  private collectionRef(): CollectionReference<DocumentData> {
    return collection(this.db(), COL.COLLECTION);
  }

  private nftRef(): CollectionReference<DocumentData> {
    return collection(this.db(), COL.NFT);
  }

  private transactionRef(): CollectionReference<DocumentData> {
    return collection(this.db(), COL.TRANSACTION);
  }

  /**
   * Get current NFT record.
   * 
   * @returns Nft
   */
  public async getNft(nftId: string): Promise<Nft> {
    const nftDoc = doc(this.nftRef(), nftId.toLowerCase());
    const nftSnapshot = await getDoc(nftDoc);
    return <Nft>nftSnapshot.data();
  }

  /**
   * Get current Collection record.
   * 
   * @returns Collection
   */
  public async getCollection(collection: string): Promise<Collection> {
    const collectionDoc = doc(this.collectionRef(), collection.toLowerCase());
    const collectionSnapshot = await getDoc(collectionDoc);
    return <Collection>collectionSnapshot.data();
  }

  /**
   * Get all NFTs owned by ETH address
   * 
   * @returns Nft[] Array of all nfts.
   */
  public async getNftsByEthAddress(ethAddress: string): Promise<Nft[]> {
    const q = query(this.nftRef(), where('owner', '==', ethAddress.toLowerCase()));
    const nftSnapshot = await getDocs(q);
    const nftList = <Nft[]>nftSnapshot.docs.map(doc => doc.data());
    return nftList;
  }

  /**
   * Listen to changes on a particular NFT
   * 
   * @return Nft Latest NFT record.
   */
  public onNft(nftId: string): Observable<Nft|undefined> {
    return new Observable((observe) => {
      const unsub = onSnapshot(doc(this.nftRef(), nftId.toLowerCase()), { includeMetadataChanges: true }, (o) => {
        observe.next(<Nft|undefined>o.data());
      });

      // Provide a way of canceling and disposing the interval resource
      return function unsubscribe() {
        unsub();
      };
    });
  }

  /**
   * Listen to changes on a particular Collection
   * 
   * @return Collection Latest Collection record.
   */
  public onCollection(collectionId: string): Observable<Collection|undefined> {
    return new Observable((observe) => {
      const unsub = onSnapshot(doc(this.nftRef(), collectionId.toLowerCase()), { includeMetadataChanges: true }, (o) => {
        observe.next(<Collection|undefined>o.data());
      });

      // Provide a way of canceling and disposing the interval resource
      return function unsubscribe() {
        unsub();
      };
    });
  }

  /**
   * Listen to all new payments on Soonaverse
   * 
   * @return Nft Latest NFT record.
   */
  public onValidPayment(): Observable<Transaction[]> {
    return new Observable((observe) => {
      const q = query(
        this.transactionRef(),
        where('type', '==', TransactionType.PAYMENT),
        where('payload.invalidPayment', '==', false),
        limit(1)
      );

      const unsub = onSnapshot(q, { includeMetadataChanges: true }, (nftSnapshot) => {
        observe.next(<Transaction[]>nftSnapshot.docs.map(doc => doc.data()));
      });

      // Provide a way of canceling and disposing the interval resource
      return function unsubscribe() {
        unsub();
      };
    });
  }


  /**
   * Get all NFTs owned by IOTA address
   * 
   * @param iotaAddresses string[] Iota Addresses to search. Max 10 addresses.
   * 
   * @returns Nft[] Array of all nfts.
   */
  public async getNftsByIotaAddress(iotaAddresses: string[]): Promise<Nft[]> {
    if (iotaAddresses.length > 10) {
      throw new Error('Max 10 addresses can be queried at once.');
    }

    // Make them all lower case.
    iotaAddresses = iotaAddresses.map((i) => {
      return i.toLowerCase();
    });

    const nftList: Nft[] = [];
    const q = query(
      this.transactionRef(), 
      where('payload.sourceAddress', 'in', iotaAddresses),
      where('type', '==', TransactionType.PAYMENT),
      where('payload.invalidPayment', '==', false)
    );
    const paymentSnapshot = await getDocs(q);
    for (const pay of paymentSnapshot.docs) {
        if (pay.data().payload.nft && pay.data().member) {
        const nftDoc = doc(this.nftRef(), pay.data().payload.nft);
        const nftSnapshot = await getDoc(nftDoc);
        // Still owner.
        if (nftSnapshot.data()?.owner === pay.data().member) {
          nftList.push(<Nft>nftSnapshot.data());
        }
      }
    }

    return nftList;
  }

  private db(): Firestore {
    return getFirestore(Soon.app);
  }
}