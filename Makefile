all:
	rm -f ./btcchina-btc-price.zip
	zip --exclude=*README.md* --exclude=*Makefile* -r ./btcchina-btc-price.zip ./*
