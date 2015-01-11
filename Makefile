all:
	rm -f ./coinbase-btc-price.zip
	zip --exclude=*README.md* --exclude=*Makefile* -r ./coinbase-btc-price.zip ./*
